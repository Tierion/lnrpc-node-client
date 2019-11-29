const assert = require('assert')
const { secp256k1, BN, SHA256 } = require('bcrypto')

const lightning = require('./src/index.js')

const LND_SOCKET = 'localhost:10009' // should be socket where your node is running
const LND_MACAROON = 'admin.macaroon' // should be absolute path to your macaroon file
const LND_CERT = 'tls.cert' // abs path to cert file

lightning.setCredentials(LND_SOCKET, LND_MACAROON, LND_CERT)

let client = lightning.lightning()
let wallet = lightning.wallet()

// key derivation function, using simple sha256 hash
function kdf(data) {
  assert(Buffer.isBuffer(data), 'Must pass a buffer to be hashed')
  return SHA256.digest(data)
}

function pubKeyToPoint(pubKey) {
  const s = BN.fromBuffer(pubKey).isOdd()
  const x = BN.fromBuffer(pubKey.slice(1, 33))
  return secp256k1.curve.pointFromX(x, s)
}

;(async function() {
  try {
    const { identity_pubkey } = await client.getInfoAsync({})

    // get the public key point coordinates for the authorizing lnd node
    const pubKeyN = Buffer.from(identity_pubkey, 'hex')
    const pubKeyNPoint = pubKeyToPoint(pubKeyN)

    // get ephemeral keys for generating shared secret
    const ephemeralPriv = secp256k1.privateKeyGenerate()
    const ephemeralPub = secp256k1.publicKeyCreate(ephemeralPriv, true)
    const ephemeralPubBuff = secp256k1.publicKeyConvert(ephemeralPub, true)

    // multiply node's public key by our ephemeral private key to generate shared pub key
    const sharedPubKey = pubKeyNPoint.mul(BN.fromBuffer(ephemeralPriv))

    // generate shared key by using our chosen KDF (Key Derivation Function)
    const sharedKey = kdf(sharedPubKey.encode(true)) // must encode (compressed) pubkey as a Buffer

    // get shared key from node with ephemeral pubkey
    const { shared_key: derivedKey } = await wallet.deriveSharedKeyAsync({ ephemeral_pubkey: ephemeralPubBuff })

    // assert that the derived shared key from the node is the same as
    // the one generated with the ephemeral key pair
    assert(sharedKey.toString('hex') === derivedKey.toString('hex'), 'Keys did not match!')

    console.log('Success!')
    console.log('Shared key:', sharedKey.toString('hex'))
  } catch (e) {
    console.error(e)
  }
})()
