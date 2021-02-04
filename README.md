

Testing on https://ffas.godziklab.org/ffas/constructs.html?dir=webdb/1604436326.39667/0&limit=100&ali=false


CD requires pre-calculated data from pdb:
1.  Download ss and disorder data from https://www.rcsb.org/pdb/static.do?p=download/http/index.html
    * https://cdn.rcsb.org/etl/kabschSander/ss.txt.gz
    * https://cdn.rcsb.org/etl/kabschSander/ss_dis.txt.gz
2. Run converter
3. Copy generfated files to https://ffas.godziklab.org/ffas/dssp/

Run test and watch changes
> npm run testWatch

Build for web:
> npx webpack

Run server:
> npx http-server   