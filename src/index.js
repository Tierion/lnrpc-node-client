const protoLoader = require('@grpc/proto-loader')
const grpc = require('grpc')
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

// Convert callbacks to async methods
exports.promisifyGrpc = () => {
  console.warn(
    '[Deprecated] Promises are supported by default as of v1.1.0. The promisifyGrpc method will be removed in a furure version.'
  )
}

// use setCredentials to initialize authenticated grpc connection
exports.setCredentials = (socketPath, macaroonPath, tlsCertPath) => {
  var m = fs.readFileSync(macaroonPath)
  var macaroon = m.toString('hex')

  var metadata = new grpc.Metadata()
  metadata.add('macaroon', macaroon)
  var macaroonCreds = grpc.credentials.createFromMetadataGenerator((_args, callback) => {
    callback(null, metadata)
  })

  var lndCert = fs.readFileSync(tlsCertPath)
  var sslCreds = grpc.credentials.createSsl(lndCert)

  const lnrpcDescriptor = grpc.loadPackageDefinition(rpcDefinition)
  const signDescriptor = grpc.loadPackageDefinition(signerDefinition)
  const walletDescriptor = grpc.loadPackageDefinition(walletDefinition)
  const invoiceDescriptor = grpc.loadPackageDefinition(invoiceDefinition)
  lndHost = socketPath
  credentials = grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds)
  lnrpc = lnrpcDescriptor.lnrpc
  signer = signDescriptor.signrpc
  wallet = walletDescriptor.walletrpc
  invoice = invoiceDescriptor.invoicesrpc
}

// use setTls to initialize unauthenticated grpc connection
exports.setTls = (socketPath, tlsCertPath) => {
  var lndCert = fs.readFileSync(tlsCertPath)

  const lnrpcDescriptor = grpc.loadPackageDefinition(rpcDefinition)
  lndHost = socketPath
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
