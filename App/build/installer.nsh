!define WINE_KEY "Software\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}"

!macro customCheckAppRunning
  DetailPrint "Closing DHFile before the update..."
  nsExec::Exec 'taskkill /IM "DHFile.exe" /T'
  Sleep 1500
  nsExec::Exec 'taskkill /F /IM "DHFile.exe" /T'
  Sleep 800
!macroend

!macro customInstall
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DHFile" "" "Open in DHFile"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DHFile" "Icon" '"$INSTDIR\DHFile.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DHFile\command" "" '"$INSTDIR\DHFile.exe" "%V"'
  WriteRegStr HKCU "Software\Classes\Directory\shell\DHFile" "" "Open in DHFile"
  WriteRegStr HKCU "Software\Classes\Directory\shell\DHFile" "Icon" '"$INSTDIR\DHFile.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\shell\DHFile\command" "" '"$INSTDIR\DHFile.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Drive\shell\DHFile" "" "Open in DHFile"
  WriteRegStr HKCU "Software\Classes\Drive\shell\DHFile" "Icon" '"$INSTDIR\DHFile.exe",0'
  WriteRegStr HKCU "Software\Classes\Drive\shell\DHFile\command" "" '"$INSTDIR\DHFile.exe" "%1"'
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    ; Give folders, drives and Win + E back to Windows Explorer when DHFile was the default.
    ReadRegStr $0 HKCU "Software\Classes\Directory\shell" ""
    StrCmp $0 "DHFile" 0 +2
      DeleteRegValue HKCU "Software\Classes\Directory\shell" ""
    ReadRegStr $0 HKCU "Software\Classes\Drive\shell" ""
    StrCmp $0 "DHFile" 0 +2
      DeleteRegValue HKCU "Software\Classes\Drive\shell" ""
    ReadRegStr $0 HKCU "${WINE_KEY}\shell\opennewwindow\command" ""
    StrCmp $0 '"$INSTDIR\DHFile.exe"' 0 +2
      DeleteRegKey HKCU "${WINE_KEY}"
    DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DHFile"
    DeleteRegKey HKCU "Software\Classes\Directory\shell\DHFile"
    DeleteRegKey HKCU "Software\Classes\Drive\shell\DHFile"
  ${endIf}
!macroend
