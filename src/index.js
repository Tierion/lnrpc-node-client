const grpc = require('grpc');
const fs = require("fs");
const path = require('path');
const protoPath = path.join(__dirname, "rpc.proto")


// Due to updated ECDSA generated tls.cert we need to let gprc know that
// we need to use that cipher suite otherwise there will be a handhsake
// error when we communicate with the lnd rpc server.
process.env.GRPC_SSL_CIPHER_SUITES = 'HIGH+ECDSA'

let lndHost
let credentials
let lnrpc

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

	const lnrpcDescriptor = grpc.load(protoPath);
	lndHost = socketPath;
	credentials = grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds);
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
