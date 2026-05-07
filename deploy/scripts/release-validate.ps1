$ErrorActionPreference = "Stop"
python "$PSScriptRoot/release-validate.py" @args
exit $LASTEXITCODE
