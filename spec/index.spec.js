import { expect } from '@jest/globals';
import CDJsonAPI from '../index.js'

jest.setTimeout(30000);

describe('cdjson-api', () => {

    // test('fail if no dir provided', () => {
    //     return 
    //     expect(CDJsonAPI.getProtein()).rejects.stringContaining('No dir found');        
    // });

    test('get protein json', () => {
        return CDJsonAPI.getProtein("db/CSGID/portal/1569528170.42106/0")
            .then((protein) => {
                // console.log("testing:")
                // console.log(protein)
                // console.log(JSON.stringify(protein, null, 2))
                expect(protein).not.toBeUndefined()
                expect(protein.sequence).not.toBeUndefined()
                expect(protein.qtracks.length).toBeGreaterThan(3)
                expect(Object.keys(protein.properties).length).toBeGreaterThan(0)
                // expect(protein.ftracks.length).toBeGreaterThan(0)
                // expect(protein.overlayfeatures.features.length).toBeGreaterThan(0)
                // expect(protein.alignments.length).toBeGreaterThan(0)
            })
    });

    test('parseDSSP', () => {
        const proteinSeq = "SSTALAGSITENTSWNKEFSAEAVNGVFVLCKSSSKSCATNDLARASKEYLPASTFKIPNAIIGLETGVIKNEHQVFKWDGKPRAMKQWERDLTLRGAIQVSAVPVFQQIAREVGEVRMQKYLKKFSYGNQNISGG--IDKFWLEDQLRISAVNQVEFLESLYLNKLSASKENQLIVKEALVTEAAPEYLVHSKTGFSGVGTESNPGVAWWVGWVEKETEVYFFAFNMDIDNESKLPLRKSIPTKIMESEGII";
        const seqFragment = "SQEIQTPAIPVNVNLGRSFNQLGIKGSILIYDRNNKKFYEHNAARNSQSFLPASTFKIFNSLVALETGVISNDVAILTWDGMQRQFPTWNQDTNIRQAFRNSTVWFYQVLARKIGHERMEKFIKQVGYGNLQIGTPEQIDRFWLEGPLQITPKQQIEFLQRLHRKELPFSQRTLDLVQDIMIYERTPNYVLRGKTGWAAS---VTPNIGWFVGYLEQNNNVYFFATNIDIRNNDDAAARIEVTRRSLKALGLL"
        const dssp = "XXXXXXXXXXXXXXXXXXXX   THHHHHHTT  EEEEEEETTTTEEEEE TTGGGS B  GGGHHHHHHHHHHHHTSS SSS EE   S   SSGGGSS EEHHHHHHHT HHHHHHHHHHH HHHHHHHHHHHT TT     GGGTTTHHHHSS  B HHHHHHHHHHHHTT SS  HHHHHHHHHHTEEEE SSEEEEEEEEEE SSSSEEEEEEEEEEETTEEEEEEEEEEESSHHHHHHHHHHHHHHHHHTT";
        const fragmentStart = 10;
        const start = 14;
        const gaps = [{ start: 136, end: 138 }];
        const expected = "XXXXXXXXXXX   THHHHHHTT  EEEEEEETTTTEEEEE TTGGGS B  GGGHHHHHHHHHHHHTSS SSS EE   S   SSGGGSS EEHHHHHHHT HHHHHHHHHHH HHHHHHHHHHHT TT     GTTTHHHHSS  B HHHHHHHHHHHHTT SS  HHHHHHHHHHTEEEE SSEEEEEEEEEE S...SSSEEEEEEEEEEETTEEEEEEEEEEESSHHHHHHHHHHHHHHHHHTT";

        const result = CDJsonAPI.parseDSSP(dssp, start, fragmentStart, gaps, seqFragment)
        // console.log(result)

        expect(result).not.toBeUndefined()
        expect(result.length).toBeGreaterThan(0)
        expect(result).toEqual(expected)

    })
})