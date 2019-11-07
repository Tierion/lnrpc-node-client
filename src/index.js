const protoLoader = require('@grpc/proto-loader')
const grpc = require('grpc')
const isBase64 = require('is-base64')
const fs = require('fs')
const path = require('path')
const bluebird = require('bluebird')

// load proto files
const loadOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}
const rpcDefinition = protoLoader.loadSync(path.join(__dirname, 'rpc.proto'), loadOptions)
const signerDefinition = protoLoader.loadSync(path.join(__dirname, 'signer.proto'), loadOptions)
const walletDefinition = protoLoader.loadSync(path.join(__dirname, 'walletkit.proto'), loadOptions)
const invoiceDefinition = protoLoader.loadSync(path.join(__dirname, 'invoices.proto'), loadOptions)
const chainDefinition = protoLoader.loadSync(path.join(__dirname, 'chainnotifier.proto'), loadOptions)

// Due to updated ECDSA generated tls.cert we need to let gprc know that
// we need to use that cipher suite otherwise there will be a handhsake
// error when we communicate with the lnd rpc server.
process.env.GRPC_SSL_CIPHER_SUITES = 'HIGH+ECDSA'

let lndHost
let credentials
let lnrpc
let signer
let wallet
let invoice
let chain

// Convert callbacks to async methods
exports.promisifyGrpc = () => {
  console.warn(
    '[Deprecated] Promises are supported by default as of v1.1.0. The promisifyGrpc method will be removed in a future version.'
  )
}

// use setCredentials to initialize authenticated grpc connection. If both
exports.setCredentials = (socketAddr, macaroonData, tlsCertData) => {
  let m
  let lndCert
  if (isBase64(macaroonData)) {
    m = Buffer.from(macaroon, 'base64')
  } else {
    m = fs.readFileSync(macaroonData)
  }
  if (isBase64(tlsCertData)) {
    lndCert = Buffer.from(tlsCertData, 'base64')
  } else {
    lndCert = fs.readFileSync(tlsCertData)
  }

  var macaroon = m.toString('hex')
  var metadata = new grpc.Metadata()
  metadata.add('macaroon', macaroon)
  var macaroonCreds = grpc.credentials.createFromMetadataGenerator((_args, callback) => {
    callback(null, metadata)
  })

  var sslCreds = grpc.credentials.createSsl(lndCert)

  const lnrpcDescriptor = grpc.loadPackageDefinition(rpcDefinition)
  const signDescriptor = grpc.loadPackageDefinition(signerDefinition)
  const walletDescriptor = grpc.loadPackageDefinition(walletDefinition)
  const invoiceDescriptor = grpc.loadPackageDefinition(invoiceDefinition)
  const chainDescriptor = grpc.loadPackageDefinition(chainDefinition)
  lndHost = socketAddr
  credentials = grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds)
  lnrpc = lnrpcDescriptor.lnrpc
  signer = signDescriptor.signrpc
  wallet = walletDescriptor.walletrpc
  invoice = invoiceDescriptor.invoicesrpc
  chain = chainDescriptor.chainrpc
}

// use setTls to initialize unauthenticated grpc connection
exports.setTls = (socketAddr, tlsCertData) => {
  let lndCert
  if (isBase64(tlsCertData)) {
    lndCert = Buffer.from(tlsCertData, 'base64')
  } else {
    lndCert = fs.readFileSync(tlsCertData)
  }

  const lnrpcDescriptor = grpc.loadPackageDefinition(rpcDefinition)
  lndHost = socketAddr
  credentials = grpc.credentials.createSsl(lndCert)
  lnrpc = lnrpcDescriptor.lnrpc
}

exports.lightning = () => {
  var lightning = new lnrpc.Lightning(lndHost, credentials)
  return bluebird.promisifyAll(lightning)
}

exports.unlocker = () => {
  var unlocker = new lnrpc.WalletUnlocker(lndHost, credentials)
  return bluebird.promisifyAll(unlocker)
}

exports.signer = () => {
  var signrpc = new signer.Signer(lndHost, credentials)
  return bluebird.promisifyAll(signrpc)
}

exports.wallet = () => {
  var walletrpc = new wallet.WalletKit(lndHost, credentials)
  return bluebird.promisifyAll(walletrpc)
}

exports.invoice = () => {
  var invoicerpc = new invoice.Invoices(lndHost, credentials)
  return bluebird.promisifyAll(invoicerpc)
}

exports.chain = () => {
  var chainrpc = new chain.ChainNotifier(lndHost, credentials)
  return bluebird.promisifyAll(chainrpc)
}
