const grpc = require('grpc');
const fs = require("fs");
const path = require('path');
const rpcPath = path.join(__dirname, "rpc.proto")
const signerPath = path.join(__dirname, "signer.proto")
const walletPath = path.join(__dirname, "walletkit.proto")
const invoicePath = path.join(__dirname, "invoices.proto")


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
exports.promisifyGrpc = function (client) {
	Object.keys(Object.getPrototypeOf(client)).forEach(function(functionName) {
		const originalFunction = client[functionName];
		let newFunc = async (req, mt) => {
			return new Promise(fill => {
				originalFunction.bind(client)(req, mt, (err, res) => {
					fill({ err, value: res });
				});
			});
		};
		client[functionName + 'Async'] = newFunc;
	});
}

// use setCredentials to initialize authenticated grpc connection
exports.setCredentials = function (socketPath, macaroonPath, tlsCertPath) {
	var m = fs.readFileSync(macaroonPath);
	var macaroon = m.toString('hex');

	var metadata = new grpc.Metadata()
	metadata.add('macaroon', macaroon)
	var macaroonCreds = grpc.credentials.createFromMetadataGenerator((_args, callback) => {
	  callback(null, metadata);
	});

	var lndCert = fs.readFileSync(tlsCertPath);
	var sslCreds = grpc.credentials.createSsl(lndCert);

	const lnrpcDescriptor = grpc.load(rpcPath);
	const signDescriptor = grpc.load(signerPath);
	const walletDescriptor = grpc.load(walletPath);
	const invoiceDescriptor = grpc.load(invoicePath);
	lndHost = socketPath;
	credentials = grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds);
	lnrpc = lnrpcDescriptor.lnrpc;
	signer = signDescriptor.signrpc;
	wallet = walletDescriptor.walletrpc;
	invoice = invoiceDescriptor.invoicesrpc;
}

// use setTls to initialize unauthenticated grpc connection
exports.setTls = function (socketPath, tlsCertPath) {
	var lndCert = fs.readFileSync(tlsCertPath);

	const lnrpcDescriptor = grpc.load(rpcPath);
	lndHost = socketPath;
	credentials = grpc.credentials.createSsl(lndCert);
	lnrpc = lnrpcDescriptor.lnrpc;
}

exports.lightning = function (){
	var lightning = new lnrpc.Lightning(lndHost, credentials);
	return lightning
}

exports.unlocker = function (){
	var unlocker = new lnrpc.WalletUnlocker(lndHost, credentials);
	return unlocker
}

exports.signer = function (){
	var signrpc = new signer.Signer(lndHost, credentials);
	return signrpc
}

exports.wallet = function (){
	var walletrpc = new wallet.WalletKit(lndHost, credentials);
	return walletrpc
}

exports.invoice = function (){
	var invoicerpc = new invoice.Invoices(lndHost, credentials);
	return invoicerpc
}
