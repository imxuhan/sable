import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rcedit } from 'rcedit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist')
const outDir = path.join(rootDir, 'out')
const resourcesSrcDir = path.join(rootDir, 'resources')
const targetDir = path.join(rootDir, 'release', 'Sable')

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const isMac = process.platform === 'darwin'
  const expectedBinary =
    process.platform === 'win32'
      ? path.join(targetDir, 'Sable.exe')
      : isMac
        ? path.join(targetDir, 'Sable.app')
        : path.join(targetDir, 'sable')

  const alreadyBootstrapped = await pathExists(expectedBinary)

  if (!alreadyBootstrapped) {
    await fs.rm(targetDir, { recursive: true, force: true })
    await fs.mkdir(path.dirname(targetDir), { recursive: true })
    console.log('Copying Electron runtime...')
    await fs.cp(electronDist, targetDir, { recursive: true, verbatimSymlinks: true })

    if (process.platform === 'win32') {
      await fs.rename(path.join(targetDir, 'electron.exe'), expectedBinary)
    } else if (isMac) {
      await fs.rename(path.join(targetDir, 'Electron.app'), expectedBinary)
    } else {
      await fs.rename(path.join(targetDir, 'electron'), expectedBinary)
    }
  } else {
    console.log('Reusing existing Electron runtime binary, updating app bundle...')
  }

  const resourcesDir = isMac
    ? path.join(targetDir, 'Sable.app', 'Contents', 'Resources')
    : path.join(targetDir, 'resources')

  await fs.rm(path.join(resourcesDir, 'default_app.asar'), { force: true })

  const appDir = path.join(resourcesDir, 'app')
  await fs.rm(path.join(appDir, 'out'), { recursive: true, force: true })
  await fs.mkdir(appDir, { recursive: true })
  await fs.cp(outDir, path.join(appDir, 'out'), { recursive: true })

  if (await pathExists(resourcesSrcDir)) {
    await fs.cp(resourcesSrcDir, path.join(appDir, 'resources'), { recursive: true })
  }

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
    const icoPath = path.join(resourcesSrcDir, 'icon.ico')
    if (await pathExists(icoPath)) {
      try {
        await rcedit(expectedBinary, {
          icon: icoPath,
          'file-version': rawPkg.version,
          'product-version': rawPkg.version,
          'version-string': {
            ProductName: 'Sable',
            FileDescription: 'Sable',
            CompanyName: 'Sable',
            InternalName: 'Sable.exe',
            OriginalFilename: 'Sable.exe'
          }
        })
        console.log('Embedded icon.ico and version info into Sable.exe')
      } catch {
        console.log(
          'Skipped updating Sable.exe icon header (Sable.exe may currently be running; close it and re-run npm run pack to update EXE icon).'
        )
      }
    }
  }

  console.log(`Updated standalone build: ${expectedBinary}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
