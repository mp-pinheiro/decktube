const { renameSync, writeFileSync, chmodSync } = require('fs')
const { join } = require('path')

exports.default = async function (context) {
  if (context.electronPlatformName !== 'linux') return

  const appOutDir = context.appOutDir
  const execName = context.packager.executableName
  const execPath = join(appOutDir, execName)
  const binPath = join(appOutDir, `${execName}.bin`)

  renameSync(execPath, binPath)
  writeFileSync(
    execPath,
    `#!/bin/bash\nHERE="$(dirname "$(readlink -f "$0")")"\nexec "$HERE/${execName}.bin" --no-sandbox --disable-dev-shm-usage "$@"\n`
  )
  chmodSync(execPath, 0o755)
}
