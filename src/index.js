const grpc = require('grpc');
const fs = require("fs");
const path = require('path');
const rpcPath = path.join(__dirname, "rpc.proto")
const signerPath = path.join(__dirname, "signer.proto")
const walletPath = path.join(__dirname, "walletkit.proto")


// Due to updated ECDSA generated tls.cert we need to let gprc know that
// we need to use that cipher suite otherwise there will be a handhsake
// error when we communicate with the lnd rpc server.
process.env.GRPC_SSL_CIPHER_SUITES = 'HIGH+ECDSA'

let lndHost
let credentials
let lnrpc
let signer
let wallet

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
	lndHost = socketPath;
	credentials = grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds);
	lnrpc = lnrpcDescriptor.lnrpc;
	signer = signDescriptor.signrpc;
	wallet = walletDescriptor.walletrpc;
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
