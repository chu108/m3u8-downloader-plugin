@echo off

chcp 65001

title %0

setlocal enabledelayedexpansion

cd /D "%~dp0"

if exist "lock" (
	exit
)

type nul > lock || exit

echo processing...

set name=default
set suffix=.mpeg

for %%i in (*.txt) do (
	set name=%%~ni
)

set path=..\mpeg\
set fileName=%path%%name%%suffix%
set tempSuffix=.download
set tempFileName=%fileName%%tempSuffix%

if exist "%fileName%" (
	exit
)

rem sometimes the name of downloaded ts file maybe not end with .ts
set tsSuffix=.ts
for %%i in (..\m3u8\*.*) do (
	if not "%%~xi" == ".m3u8" (
		if not "%%~xi" == "%tsSuffix%" (
			ren "%%i" "%%~ni%%~xi%tsSuffix%" || exit
		)
	)
)

set count=0
for %%f in (..\m3u8\*.ts) do (
	set /a count+=1 || exit
)

if %count% EQU 0 (
	exit
)

set expectedCount=0
for %%i in (..\m3u8\*.m3u8) do (
	for /f "tokens=1 delims=-" %%s in ("%%~ni%") do (
		set expectedCount=%%s
	)
)

if %count% NEQ %expectedCount% (
	exit
)

md "%path%" || exit

set num=0
set percent=0
for %%f in (..\m3u8\*.ts) do (
    type "%%f" >> "%tempFileName%" || exit
	set /a num+=1 || exit
	set /a percent=num*100/count || exit
	echo !percent!%%
)

cd "%path%" || exit
ren "%name%%suffix%%tempSuffix%" "%name%%suffix%" || exit

echo done

start .

exit
