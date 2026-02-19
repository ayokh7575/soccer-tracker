const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourceSvg = path.join(__dirname, '..', 'public', 'clock-soccer.svg');
const outputDir = path.join(__dirname, '..', 'public');
const sizes = [192, 512];

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generatePngs() {
  console.log('Generating PNG icons from SVG...');

  try {
    for (const size of sizes) {
      const outputFilename = `logo${size}.png`;
      const outputPath = path.join(outputDir, outputFilename);

      await sharp(sourceSvg).resize(size, size).png().toFile(outputPath);

      console.log(`✅ Successfully created ${outputPath}`);
    }
    console.log('\nIcon generation complete!');
  } catch (error) {
    console.error('❌ Error generating PNG icons:', error);
  }
}

generatePngs();
