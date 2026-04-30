import { readFileSync, writeFileSync } from 'fs'

const targetVersion = process.argv[2]
if (!targetVersion) {
    console.error('Please provide a target version as a command line argument.')
    process.exit(1)
}

function normalizeVersionTag(tag) {
    const trimmedTag = tag.trim().replace(/^refs\/tags\//, '')
    const versionMatch = trimmedTag.match(/^(?:v)?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/i)

    return versionMatch ? versionMatch[1] : trimmedTag.replace(/^v(?=\d)/i, '')
}

const normalizedVersion = normalizeVersionTag(targetVersion)

function writeJsonFile(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
const { minAppVersion } = manifest
manifest.version = normalizedVersion
writeJsonFile('manifest.json', manifest)

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync('versions.json', 'utf8'))
versions[normalizedVersion] = minAppVersion
writeJsonFile('versions.json', versions)

// update package.json with target version
let packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
packageJson.version = normalizedVersion
writeJsonFile('package.json', packageJson)

// keep package-lock.json aligned with the released version
let packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
packageLock.version = normalizedVersion
if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = normalizedVersion
}
writeJsonFile('package-lock.json', packageLock)

console.log(normalizedVersion)
