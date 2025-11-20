import { up, down } from './migrations/001_init_indexes'

async function main() {
  const direction = (process.env.MIGRATION_DIRECTION || 'up').toLowerCase()
  if (direction === 'down') {
    await down()
    return
  }
  await up()
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
}