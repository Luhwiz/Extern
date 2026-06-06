!macro customInstall
  ExecWait 'powershell.exe -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"'
!macroend
