
import $, { data } from "jquery";

/** 
 * Load order:
 * 1. Fasta
 * 2. Summary
 * 2.1 Disopred - tab delimited, skip 5 lines, use second columns from the end
 * 2.2 Psipred -  tab delimited, skip 2 lines, fill 3 qtracks with data
 * 2.3 Transmembrane -  tab delimited
 * 2.4 Seg(
 * 2.5 Coils
 * 3. Pdb101 -alignment file
 * 4.loadSurfpred(protein, url, out); - tba
 * 5.loadCorservpred(protein, url, out); - tba
 * 
 */

const getProtein = async (dir, showAli, limit) => {
    const failed = function (msg) {
        return new Promise(function (resolve, reject) {
            reject(`ConstructDesignerAPI failed: ${msg}`);
        });
    }

    !dir && failed("No dir provided");

    const FFAS_PREFIX = "https://xtalpred.godziklab.org/XtalPred-cgi/";
    const BASE_URL = FFAS_PREFIX + "download.pl?dir:d";
    const PDBSS_URL = "http://www.rcsb.org/pdb/explore/sequenceText.do?structureId:3RGZ&chainId:A&format:txt"

    const F = { // file names
        DSSP_BASE: "",
        // sequence in FASTA
        fasta: "A.csq",

        // file with loop, helix, strand
        psipred: "A.ss2",
        // file with disordered region predicted by DISOPRED2
        disopred: "A.diso",
        // file with low complexity region predicted by SEG
        seqpred: "A.seg",

        // coiled coils region predicted by COILS
        coildpred: "A.coils",

        // transmembrane helices predicted by TMHMM
        tmhdpred: "A.tmh",

        // surface accessibility (we show column 5)
        surfpred: "A.nets",

        // evolutionary conservation
        evolconspred: "A.co",
    }

    // create default protein onject with pre-populated data
    const coil = "#696969";;
    const helix = "red";
    const strand = "blue";

    let protein = {
        label: "",
        seq: "",
        seqcolors: {
            colors: {
                "H": helix,
                "E": strand,
                "C": coil,

                "G": helix,
                "I": helix,

                "B": strand,
                "T": coil,

                "S": coil,
                " ": "#DDD",
                "X": "orange" // disorder,
            },
            data: ""
        },

        alignments: [],
        qtracks: [],
        ftracks: [],
        overlayfeatures: { label: "Predictions", features: [] },
        markers: [],
        properties: {}
    }

    // main url prefix
    const url = FFAS_PREFIX + "download.pl?dir=" + dir + "/";

    // try to load fasta file first
    const fasta = await loadFasta(url + F.fasta);
    // if failed t oload return null
    if (!fasta || !fasta.length) return null;

    //parse fasta
    // console.log(fasta)

    let lines = linesFromData(fasta);
    if (lines[0].startsWith(">")) {
        protein.label = lines[0].substring(1);
        lines[0] = ""
    }
    protein.sequence = lines.join("");
    protein.label = protein.label.replace(/\r/g, "");
    protein.sequence = protein.sequence.replace(/\r/g, "");
    protein.sequence = protein.sequence.replace(/\n/g, "");


    // function to get data from url and process using callback
    // extras is the array of additional params for callback function
    const getNextData = async function (title, url, callback, extras) {
        try {
            const data = await getPromise(title, url);
            await callback(data, protein, extras);
            // console.log(`Protein after ${title} :`);
            // console.log(protein);
        } catch (e) {
            failed(`Failed to load ${title}: ${e}`)
        }
    }

    await getNextData("Summary", url + "&type=summary", parseSummary);
    await getNextData("psi-blast", url + "pdb101.ali", parsePDB101, [showAli, limit]);
    await getNextData("SurfPred", url + F.surfpred, parseSurfPred)
    await getNextData("SurfPred", url + F.evolconspred, parseConsPred)

    // //     loadSurfpred(protein, url, out);
    // //     loadCorservpred(protein, url, out);

    return protein;

}

const loadFasta = function (url) {
    console.log(`Loading fasta: ${url}`)

    return $.ajax({
        type: 'GET',
        cache: false,
        url: url,
        async: false
    })
}

const getPromise = function (title, url) {
    console.log(`Loading ${title}: ${url}`)

    return $.ajax({
        type: 'GET',
        cache: false,
        url: url,
        async: false
    });
}

const parseSummary = async function (data, protein) {
    //  console.log(data)
    // console.log("*****************************************************")

    /**
     * Summary file contains "blocks" in the following order:
     * (need to remove first 2 lines in each block to get actual content)
     * 1. FASTA and properties
     * 2. SEG output (low complexity)
     * 3. COILS output
     * 4. TMHMM output
     * 5. PSIPRED output:
     * 6. DISOPRED2 output:
     */

    let blocks = data.split("------------------------------------------------------------------------------------------------------------------------")

    parseDisopred(blocks[5], protein);
    parsePSIpred(blocks[4], protein);
    parseTMH(blocks[3], protein);
    parseSegpred(blocks[1], protein);
    parseCoils(blocks[2], protein);
    parseProperties(blocks[0], protein);
}

const parseDisopred = function (data, protein) {
    // console.log(data)
    // console.log("*****************************************************")
    data = data.replace("DISOPRED2 output:", "");

    const lines = linesFromData(data);
    const skip = 5;

    let track = { color: "orange", label: "Disorder", values: [] }

    for (let l = skip; l < lines.length; l++) {
        let parts = lines[l].split(" ");
        parts.length > 4 && track.values.push(parseFloat(parts[parts.length - 1]));
    }
    protein.qtracks.push(track);
}

const parsePSIpred = function (data, protein) {
    // console.log(data)
    // console.log("*****************************************************")

    data = data.replace("PSIPRED output:", "");
    const lines = linesFromData(data);

    const skip = 2;
    let coilTrack = { color: "#000", label: "Coil", values: [] }
    let helixTrack = { color: "red", label: "Helix", values: [] }
    let strandTrack = { color: "blue", label: "Strand", values: [] }


    for (let l = skip; l < lines.length; l++) {
        let line = lines[l].trim();
        if (line.length === 0) continue;

        let parts = line.replace(/  +/g, ' ').split(" ");
        if (parts.length < 6) continue;
        let inc = parts.length > 6 ? 1 : 0;

        coilTrack.values.push(parseFloat(parts[3 + inc]));
        helixTrack.values.push(parseFloat(parts[4 + inc]));
        strandTrack.values.push(parseFloat(parts[5 + inc]));
    }
    protein.qtracks.push(coilTrack);
    protein.qtracks.push(helixTrack);
    protein.qtracks.push(strandTrack);
}

const parseTMH = function (data, protein) {
    // console.log(data);
    // console.log("*****************************************************");
    data = data.replace("TMHMM output:", "");
    const lines = linesFromData(data);

    lines.forEach(l => {
        l = l.trim();
        if (l.length > 0 && !l.startsWith("#")) {
            let parts = l.replace(/\t+/g, ' ').replace(/ +/g, ' ').split(" ");

            if (parts.length > 4 && parts[2].trim() === "TMhelix") {
                protein.overlayfeatures.features.push({
                    start: parseInt(parts[3].trim()),
                    end: parseInt(parts[4].trim()),
                    color: "#9acd32",
                    regionType: "TRANSMEMBRANE HELIX",
                    flLabel: "TMhelix"
                });
            }
        }
    });
}

const parseSegpred = function (data, protein) {
    // console.log(data);
    // console.log("*****************************************************");
    data = data.replace("SEG output:", "");
    const lines = linesFromData(data);

    if (lines[0].startsWith(">")) {
        lines[0] = ""
    }

    let seq = lines.join("").trim();

    let re = /x+/g;
    let match;
    while ((match = re.exec(seq)) != null) {

        protein.overlayfeatures.features.push({
            start: match.index,
            end: match.index + match[0].length,
            color: "#DDD",
            regionType: "LOW COMPLEXITY",
            label: "Low complexity"
        });
    }
}

const parseCoils = function (data, protein) {
    // console.log(data);
    // console.log("*****************************************************");
    data = data.replace("COILS output:", "");
    let lines = linesFromData(data);

    if (lines[0].startsWith(">")) {
        lines[0] = ""
    }

    let seq = lines.join("");
    let re = /x+/g;
    let match;

    while ((match = re.exec(seq)) != null) {
        protein.overlayfeatures.features.push({
            start: match.index,
            end: match.index + match[0].length,
            color: "#444",
            regionType: "COILS",
            label: "Coils"
        });
    }
}

const parseProperties = function (data, protein) {
    // console.log(data);
    // console.log("*****************************************************");
    data = data.replace("Protein sequence in FASTA format:", "");
    const lines = linesFromData(data);
    lines.forEach(l => {
        const parts = l.split(":");
        if (parts.length > 1) {
            protein.properties[parts[0].trim()] = parts[1].trim()
        }
    })
}

const parsePDB101 = async function (data, protein, extras) {
    const showAli = extras[0] || false;
    const limit = extras[1] || 1
    // console.log(data)
    // console.log("*****************************************************")
    let re = /-+/g;

    const dsspPrefix = "https://ffas.godziklab.org/ffas/dssp/";

    const lines = linesFromData(data);
    const skip = 2;
    let start = -1;
    let c = 0; // counter

    let gaps = []; // gaps in original sequence, have to be deleter from dssp

    let pfragSeq = ""; // aligned fragment or original proteins
    let desc = "";
    let label = "";

    for (let i = skip; i < lines.length; i++) {
        if (c > limit) {
            // console.log(`read ${c} alignments. exiting read cycle`)
            break;
        }
        let l = lines[i].trim();

        // console.log(l);

        if (l.startsWith(">")) {
            c++;
            // header line
            //  >   1.000e-15 >1vhx_A 150aa (NONE) 12/01/03 (X-RAY) Putative Holliday junction resolvase [BACILLUS SUBTILIS] :_: Frame:0 Round:0 Length:150
            desc = l.substring(1).split(">")[1] || "";
            label = desc.split(":")[0].trim();

            // console.log(`Header line: \n${desc} \n${label}`)
        } else if (start < 0) {
            let pt = l.trim().split(" ");
            // console.log(pt)
            if (pt.length > 1) {
                start = parseInt(pt[0].trim());
                pfragSeq = pt[1];
            }

            // console.log(`Parsed out start: ${start}\nand pfragSeq:\n${pfragSeq}`)
            let match;

            while ((match = re.exec(pfragSeq.trim())) != null) {
                gaps.push({
                    start: match.index,
                    end: match.index + match[0].length
                })
            }
            // console.log(gaps)
        }
        else if (start > 0) {
            // got aligned sequence
            const aliPdb = label.split(" ")[0].replace("_", "")

            // console.log(`Have start, will parse ali`)
            // console.log(aliPdb)

            let pt = l.trim().split(" ");
            let seq = pt[1].trim();

            // alignment object http://sanshu.github.io/protaelweb/docs/index.html#ali
            let ali = {
                label: aliPdb,
                description: label,
                gaps: gaps,
                start: start,
                sequence: seq,
                fragmentStart: parseInt(pt[0].trim())
            };

            if (!showAli) {
                ali.CS = "ALI"; // no coloring
            }

            // console.log(ali);

            let dsspData = await getPromise(`dssp for ${aliPdb} (${c})`, dsspPrefix + aliPdb);

            const parts = dsspData.split("\n");
            parts[0] = ""; // get rid of header line
            let dsspStr = parts.join(""); //actual SS sequence

            // console.log(pfragSeq)

            ali.seqcolors = {
                data:
                    parseDSSP(dsspStr,
                        ali.start,
                        ali.fragmentStart,
                        ali.gaps,
                        ali.sequence,
                        protein.sequence
                    )
            };

            protein.alignments.push(ali);

            // console.log(ali);

            // reset for the next alignment
            start = -1;
            gaps = [];
        }
    }
}

const parseDSSP = function (dssp, start, fragmentStart, deletions, seq, protSeq) {
    if (!dssp || !dssp.length)
        return "";

    let a = seq.substring(start - 1)
    let re = /-+/g;

    // console.log(`before:\n${a}\n${seq}\n${str}`)


    // >6NHS_1|Chain A|Beta-lactamase|Nostoc sp. (strain PCC 7120 / SAG 25.82 / UTEX 2576) (103690)
    // SNARDMPGHSQEIQTPAIPVNVNLGRSFNQLGIKGSILIYDRNNKKFYEHNAARNSQSFLPASTFKIFNSLVALETGVISNDVAILTWDGMQRQFPTWNQDTNIRQAFRNSTVWFYQVLARKIGHERMEKFIKQVGYGNLQIGTPEQIDRFWLEGPLQITPKQQIEFLQRLHRKELPFSQRTLDLVQDIMIYERTPNYVLRGKTGWAASVTPNIGWFVGYLEQNNNVYFFATNIDIRNNDDAAARIEVTRRSLKALGLL
    // >6nhsA
    // XXXXXXXXXXXXXXXXXXXX   THHHHHHTT  EEEEEEETTTTEEEEE TTGGGS B  GGGHHHHHHHHHHHHTSS SSS EE   S   SSGGGSS EEHHHHHHHT HHHHHHHHHHH HHHHHHHHHHHT TT     GGGTTTHHHHSS  B HHHHHHHHHHHHTT SS  HHHHHHHHHHTEEEE SSEEEEEEEEEE SSSSEEEEEEEEEEETTEEEEEEEEEEESSHHHHHHHHHHHHHHHHHTT  
    //          SQEIQTPAIPVNVNLGRSFNQLGIKGSILIYDRNNKKFYEHNAARNSQSFLPASTFKIFNSLVALETGVISNDVAILTWDGMQRQFPTWNQDTNIRQAFRNSTVWFYQVLARKIGHERMEKFIKQVGYGNLQIGTPEQIDRFWLEGPLQITPKQQIEFLQRLHRKELPFSQRTLDLVQDIMIYERTPNYVLRGKTGWAAS---VTPNIGWFVGYLEQNNNVYFFATNIDIRNNDDAAARIEVTRRSLKALGLL
    //          SSTALAGSITENTSWNKEFSAEAVNGVFVLCKSSSKSCATNDLARASKEYLPASTFKIPNAIIGLETGVIKNEHQVFKWDGKPRAMKQWERDLTLRGAIQVSAVPVFQQIAREVGEVRMQKYLKKFSYGNQNISGG--IDKFWLEDQLRISAVNQVEFLESLYLNKLSASKENQLIVKEALVTEAAPEYLVHSKTGFSGVGTESNPGVAWWVGWVEKETEVYFFAFNMDIDNESKLPLRKSIPTKIMESEGII
    ///////////////////                                                                                                                                 || deletion                                                     ||| insertion    
    //          XXXXXXXXXXX   THHHHHHTT  EEEEEEETTTTEEEEE TTGGGS B  GGGHHHHHHHHHHHHTSS SSS EE   S   SSGGGSS EEHHHHHHHT HHHHHHHHHHH HHHHHHHHHHHT TT     GTTTHHHHSS  B HHHHHHHHHHHHTT SS  HHHHHHHHHHTEEEE SSEEEEEEEEEE S...SSSEEEEEEEEEEETTEEEEEEEEEEESSHHHHHHHHHHHHHHHHHTT  


    // remove the very first gap (ali start) to ensure that positions are the same
    let dsspStr = dssp.substring(fragmentStart - 1)
    // if (!str.startsWith("XXXXXXXXXXX   THHHHHHTT"))
    //     console.error("fix start")
    // else {
    //     console.log("start is ok")
    // }

    //insert gaps from the aligned PDB fragment into dssp string
    let match;
    let insertions = [];

    while ((match = re.exec(seq.trim())) != null) {
        insertions.push({
            start: match.index,
            end: match.index + match[0].length
        })
    }
    // console.log("deletions and insertions")
    // console.log(deletions)
    // console.log(insertions)

    let chars = dsspStr.split('');

    for (let i = insertions.length; i > 0; i--) {
        let ins = insertions[i - 1]
        // console.log(ins)
        for (let j = ins.start; j < ins.end; j++) {
            chars.splice(j, 0, '.')
            // console.log(`inserted at ${j}`)
        }
    }

    for (let i = deletions.length; i > 0; i--) {
        let del = deletions[i - 1]
        // console.log(del)
        for (let j = del.start; j < del.end; j++) {
            let d = chars.splice(j, 1, '')
            // console.log(`deleted at ${j}: ${d}`)

        }
    }
    // console.log(protSeq.substring(start - 1) + "\n" + chars.join("")+"\n"+dssp)

    return chars.join("");
}

const linesFromData = function (data) {
    let lines = data.trim().split("\n");
    if (lines[lines.length - 1].trim() === "SP:")
        lines.pop();
    return lines;
}

const parseSurfPred = function (data, protein) {
    // console.log(data)

    const lines = linesFromData(data);

    let track = { color: "#8F6B00", label: "Surface accesibility", type: "column", values: [] }

    lines.forEach(l => {
        l = l.trim().replace(/\s+/g, " ")
        if (!l.startsWith("#")) {
            let parts = l.split(" ");
            track.values.push(parseFloat(parts[4]) || 0);
        }
    })

    protein.qtracks.push(track);
    console.log(track)
}

const parseConsPred = function (data, protein) {
    // console.log(data)
    const lines = linesFromData(data);

    let track = { color: "#006600", label: "Evolutionary conservation", type: "column", values: [] }

    for (let l in lines) {
        let line = lines[l].trim().replace(/\s+/g, " ")
        if (line.startsWith("*")) {
            // end of data
            break;
        }
        let parts = line.split(" ");
        track.values.push(parseFloat(parts[2]) || 0);

    }
    // console.log(track)
    protein.qtracks.push(track);
}

export default {
    getProtein,
    parseDSSP
}