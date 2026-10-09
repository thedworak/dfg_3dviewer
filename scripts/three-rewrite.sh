#!/bin/bash

OLD_BUILD=$1
BUILD=$2

#cp -R -p viewer/build viewer/build_${OLD_BUILD}
#cp -R -p viewer/js/jsm viewer/js/jsm_${OLD_BUILD}
#wget https://github.com/mrdoob/three.js/archive/refs/tags/r172.zip
#unzip r172.zip
#rm r172.zip
#cp -R three.js-r172/build/* viewer/build/
#cp -R three.js-r172/examples/jsm/* viewer/js/jsm/
#rm -rf three.js-r172 viewer/build_${OLD_BUILD} viewer/js/jsm_${OLD_BUILD}

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
