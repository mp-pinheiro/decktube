const { renameSync, writeFileSync, chmodSync } = require('fs')
const { join } = require('path')

exports.default = async function (context) {
  if (context.electronPlatformName !== 'linux') return

  const appOutDir = context.appOutDir
  const productName = context.packager.appInfo.productFilename
  const execPath = join(appOutDir, productName)
  const binPath = join(appOutDir, `${productName}.bin`)

  renameSync(execPath, binPath)
  writeFileSync(
    execPath,
    `#!/bin/bash\nHERE="$(dirname "$(readlink -f "$0")")"\nexec "$HERE/${productName}.bin" --no-sandbox --disable-dev-shm-usage "$@"\n`
  )
  chmodSync(execPath, 0o755)
}
