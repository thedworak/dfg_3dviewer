#!/bin/bash

#cp -R -p viewer/build viewer/build_171
#cp -R -p viewer/js/jsm viewer/js/jsm_171
#wget https://github.com/mrdoob/three.js/archive/refs/tags/r172.zip
#unzip r172.zip
#rm r172.zip
#cp -R three.js-r172/build/* viewer/build/
#cp -R three.js-r172/examples/jsm/* viewer/js/jsm/

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
