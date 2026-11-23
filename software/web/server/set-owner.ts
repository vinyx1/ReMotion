/*
  Create the owner's account, or give it a new password:

      node server/set-owner.ts vincent@remotion.demo            a new random password, printed once
      node server/set-owner.ts vincent@remotion.demo 'my pass'  that password

  The password is stored only as a hash (data/state/accounts.json). Changing it signs the
  owner out everywhere.
*/
import { randomBytes } from 'node:crypto'
import { setOwner } from './accounts.ts'

const [email, given] = process.argv.slice(2)
if (!email?.includes('@')) {
  console.error('usage: node server/set-owner.ts <email> [password]')
  process.exit(1)
}
const password = given ?? randomBytes(9).toString('base64url')
await setOwner(email, password)
console.log(`Owner account: ${email.toLowerCase()}`)
if (!given) console.log(`Password:      ${password}   (shown once; it's only stored as a hash)`)
process.exit(0)
