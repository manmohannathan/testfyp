> Historical notes from an earlier edition. Use START-HERE.md, PROJECT-MAP.md and PRESENTATION-GUIDE.md in the project root for the current build.

> Previous floor-demo notes. Current camera layout, four-location support and media setup are documented in UPDATE-GUIDE.md.

# UMSKAL: 13-floor supervisor demonstration

This version uses the newer `umskal_.gltf` and `umskal_.bin` from your latest ZIP. Your uploaded source and earlier project copies are unchanged.

## Quick presentation

1. Extract the ZIP. Copy the `Labuan-Ar-Tabletop` folder into XAMPP's `htdocs` under that name.
2. Start Apache and open `http://localhost/Labuan-Ar-Tabletop/` on your computer.
3. Choose **Explore in 3D first**, then **Discover**. The view moves closer to the main tower.
4. Choose any floor from **1 to 13**. Its band lights up and its sample information appears. Rotate or zoom to show that the highlight follows the model.
5. Try **Lower floor / Upper floor**, and **Campus view / Focus tower**. All 13 floors remain reachable through the picker; only the current floor's marker is shown on the building to avoid overlapping labels.
6. Switch to **Melayu** to show the translated floor information.
7. Explore all 13 floors to collect the campus passport stamp, or complete the optional demo challenge. The Clock Tower still has three discovery points.

For the camera demo, use the original UMSKAL marker from **View the markers**. The new 3D model still uses that marker. Test the published HTTPS site on your phone before presenting; a computer's plain HTTP LAN address normally cannot provide camera access on a phone.

## Sample floor directory

| Demo floor | Example space |
|---|---|
| 1 | Welcome & reception |
| 2 | Student services |
| 3 | Learning commons |
| 4 | Computer laboratory |
| 5 | Multimedia studio |
| 6 | Business learning hub |
| 7 | Research lounge |
| 8 | Innovation workshop |
| 9 | Seminar rooms |
| 10 | Academic meeting suite |
| 11 | Digital heritage gallery |
| 12 | Collaboration lounge |
| 13 | Project showcase |

These are invented demonstration descriptions, not claims about actual UMSKAL room allocations. The interface explicitly labels them as demo content in both languages. Replace the descriptions in `coding/content.js` after obtaining the real floor directory.

The model contains continuous facade meshes rather than 13 separately named floors. This edition divides the tower shaft and crown into 13 equal-height display bands, excluding the roof. Locations are approximate; Floor 1 means the lowest demo band. Real floor heights and the official ground/first-floor numbering can be configured later from verified plans.

The stories and campus quiz now reference the sample floor directory, and the progress counter uses 13 for UMSKAL and 3 for Clock Tower. Old completion of the previous campus three-point activity does not automatically complete this floor activity. Existing Clock Tower progress is retained when using the same browser and site address.

## Checks

Tested with the actual new model: all 13 floor selections, boundaries at Floors 1/13, sample labels in English/Malay, 12 versus 13 completion, stored progress, old-progress migration, story and quiz flow, unchanged Clock Tower discoveries, and phone/landscape/desktop widths. Both original markers were also tested through a synthetic camera feed. Physical phone tracking, lighting and performance still need your final check.
