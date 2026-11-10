// Illustrative route destinations. Historical model versions are configured separately.
const enms=(en,ms)=>({en,ms});
export const INTERACTIVE = {
  umslic: {

    routes:[{name:enms('Main building','Bangunan utama'),match:['Tower | cream shaft']},{name:enms('Entrance lobby','Lobi masuk'),match:['Central entrance lobby']},{name:enms('Campus gateway','Pintu masuk kampus'),match:['Entrance checkpoint red canopy']}]
  },
  labuanclocktower:{
routes:[{name:enms('Tower approach','Laluan menara'),point:2},{name:enms('Clock viewing stop','Hentian melihat jam'),point:0},{name:enms('Architecture stop','Hentian seni bina'),point:1}]
  },
  surrenderpoint:{
routes:[{name:enms('Entrance arch','Gerbang masuk'),point:0},{name:enms('Memorial stop','Hentian tugu'),point:1},{name:enms('Information tablet','Panel maklumat'),point:2}]
  },
  lisc:{
routes:[{name:enms('Main hall stop','Hentian dewan utama'),point:0},{name:enms('Fountain stop','Hentian air pancut'),point:1},{name:enms('Promenade stop','Hentian persiaran'),point:2}]
  }
};
