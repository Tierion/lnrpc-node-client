const lightning = require("lnrpc-node-client");

lightning.setCredentials('34.66.56.153:10009', '/home/jacob/.lnd/admin.macaroon', '/home/jacob/.lnd/tls.cert')

let client = lightning.lightning()
let unlocker = lightning.unlocker()

let seed = ""
let pass = ""


unlocker.initWallet({wallet_password: pass, cipher_seed_mnemonic: seed.split(' ')}, (err, res) => { console.log(res); console.log(err); });


unlocker.unlockWallet({wallet_password:pass}, (err, res) => { console.log(res); console.log(err); });


client.getTransactions({num_confirmations:793}, (err, res) => { console.log(res); console.log(err); });


client.getBlock({block_height:793}, (err, res) => { console.log(res); console.log(err); });
