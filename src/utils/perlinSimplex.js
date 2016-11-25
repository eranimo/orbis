import SimplexNoise from 'simplex-noise';
import nj from 'numjs';
import Random from './random';


export default function perlinSimplex(width, height, xpos = 0, ypos = 0, seed = null, range = 255) {
  console.log(`Generating for ${xpos}, ${ypos}`)
  const random = new Random(seed);
  var gen = new SimplexNoise(() => random.random());
  function noise(nx, ny) {
    // Rescale from -1.0:+1.0 to 0.0:1.0
    return gen.noise2D(nx, ny) / 2 + 0.5;
  }

  const rescale = value => value * range;

  const heightmap = nj.zeros([width, height]);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const nx = x / width - 0.5;
      const ny = y / height - 0.5;

      const v1 = 1    * noise(1 * (xpos + nx), 1 * (ypos + ny));
      const v2 = 0.5  * noise(2 * (xpos + nx), 2 * (ypos + ny));
      const v3 = 0.25 * noise(4 * (xpos + nx), 4 * (ypos + ny));
      heightmap.set(x, y, rescale(Math.pow(v1, 4.7)));
    }
  }
  console.log('min', heightmap.min())
  console.log('max', heightmap.max())
  console.log('mean', heightmap.mean())
  return heightmap;
}
