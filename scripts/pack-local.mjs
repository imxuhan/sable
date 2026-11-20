import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist')
const outDir = path.join(rootDir, 'out')
const targetDir = path.join(rootDir, 'release', 'Sable')

async function main() {
  await fs.rm(targetDir, { recursive: true, force: true })
  await fs.mkdir(path.dirname(targetDir), { recursive: true })

  console.log('Copying Electron runtime...')
  await fs.cp(electronDist, targetDir, { recursive: true })

  const defaultAsar = path.join(targetDir, 'resources', 'default_app.asar')
  await fs.rm(defaultAsar, { force: true })

  const appDir = path.join(targetDir, 'resources', 'app')
  await fs.mkdir(appDir, { recursive: true })
  await fs.cp(outDir, path.join(appDir, 'out'), { recursive: true })

  const rawPkg = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf-8'))
  const minimalPkg = {
    name: rawPkg.name,
    productName: rawPkg.productName,
    version: rawPkg.version,
    description: rawPkg.description,
    license: rawPkg.license,
    main: './out/main/index.js'
  }
  await fs.writeFile(
    path.join(appDir, 'package.json'),
    JSON.stringify(minimalPkg, null, 2),
    'utf-8'
  )

  if (process.platform === 'win32') {
    const oldExe = path.join(targetDir, 'electron.exe')
    const newExe = path.join(targetDir, 'Sable.exe')
    await fs.rename(oldExe, newExe)
    console.log(`Packaged standalone executable: ${newExe}`)
  } else {
    console.log(`Packaged standalone app in: ${targetDir}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
