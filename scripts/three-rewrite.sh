#!/bin/bash

BUILD=$1

fixlinks() {
  BASE=${1/#\.\//}
  BASE=${BASE//[!\/]/}
  BASE=${BASE//\//..\/}
  BASE=${BASE/\.\.\//}
  if [[ $BASE ]]; then
    echo $BASE
    sed -i "s#} from 'three';#} from '${BASE}build/three.module.js';#" $1
  fi
}

# iterate over all files from the site root
find viewer/js/jsm${BUILD}/ -type f -name "*.js"  | while read file; do fixlinks "$file"; done
#
