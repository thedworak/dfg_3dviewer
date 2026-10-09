param (
    [string]$OLD_BUILD,
    [string]$BUILD
)


function Fix-Links($filePath) {
    # Normalize path
    $normalizedPath = $filePath -replace '\\', '/'

    # Define root folder
    $root = "viewer/js/jsm"

    # Get relative path from root
    $relativePath = $normalizedPath.Substring($normalizedPath.IndexOf($root) + $root.Length)

    # Count slashes = subfolder depth (excluding the file itself)
    $depth = ($relativePath -split '/').Count

    # Create base path with correct depth
    $base = ('../' * $depth)

    if ($base) {
        Write-Host "Fixing $filePath → Base: $base"
        (Get-Content $filePath) -replace "}\s+from\s+'three';", "} from '${base}build/three.module.js';" |
            Set-Content $filePath
    }
}

Get-ChildItem -Recurse -Path "viewer/js/jsm" -Filter *.js | ForEach-Object {
    Fix-Links $_.FullName
}