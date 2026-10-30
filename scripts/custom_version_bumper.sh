#!/usr/bin/env bash

# release_me is going to handle bumping the version number in the
# package.json
#
# but it doesn't know anything about manifest.webfest
#
#
#
# can also echo "\x1b[1;37m"
ESCAPE=$(printf "\033")
RED="${ESCAPE}[91m"
GREEN="${ESCAPE}[92m"
YELLOW="${ESCAPE}[33m"
WHITE="${ESCAPE}[37m"
BOLD_WHITE="${ESCAPE}[1;37m"
NOCOLOR="${ESCAPE}[0m"


current_version=$(grep '"version":' package.json | sed -e 's/",.*//' -e 's/.*"//')
if [ "$current_version" != "" ]; then
    echo $GREEN"Bumping icon version to $current_version"$NOCOLOR
else
    echo $RED"unable to extract version number from package.json"$NOCOLOR
    exit 1
fi
dest_file=dist/manifest.webmanifest
src_file=src/manifest.webmanifest
sed -e "s/{VERSION}/$current_version/g" $src_file > $dest_file
message="Versioned icon in $dest_file at v$current_version"
# stuff in dist isn't version controlled
# git add $dest_file
# git commit -m "$message"
if [ $? -eq 0 ]; then
    echo $GREEN"$message"$NOCOLOR
else
    echo $RED"unable to commit version bump to $file"$NOCOLOR
    exit 1
fi
