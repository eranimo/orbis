import nj from 'numjs';


// Olsen infinite noise
// from http://godsnotwheregodsnot.blogspot.com/2014/08/3d-olsen-noise.html
export default function olsenNoise(width, height, xpos = 0, ypos = 0, seed = 0) {
  var SCALE_FACTOR = 2;
  //The scale factor is kind of arbitrary, but the code is only consistent for 2 currently. Gives noise for other scale but not location proper.
  var BLUR_EDGE = 3; //extra pixels are needed for the blur (3 - 1).
  var buildbuffer = BLUR_EDGE + SCALE_FACTOR;

  var stride = width + buildbuffer;
  var colorvalues = new Array(stride * (height + buildbuffer));
  var iterations = 9;
  var singlecolor = true;


  /**
   * Function adds all the required ints into the ints array.
   * Note that the scanline should not actually equal the width.
   * It should be larger as per the getRequiredDim function.
   *
   * @param iterations Number of iterations to perform.
   * @param ints       pixel array to be used to insert values. (Pass by reference)
   * @param stride     distance in the array to the next requestedY value.
   * @param x          requested X location.
   * @param y          requested Y location.
   * @param width      width of the image.
   * @param height     height of the image.
   */

  function fieldOlsenNoise(iterations, ints, stride, x, y, width, height) {
    olsennoise(ints, stride, x, y, width, height, iterations); //Calls the main routine.
    //applyMask(ints, stride, width, height, 0xFF000000);
  }

  function applyMask(pixels, stride, width, height, mask) {
    var index;
    index = 0;
    for (var k = 0, n = height - 1; k <= n; k++, index += stride) {
      for (var j = 0, m = width - 1; j <= m; j++) {
        pixels[index + j] |= mask;
      }
    }
  }

  /**
   * Converts a dimension into the dimension required by the algorithm.
   * Due to the blurring, to get valid data the array must be slightly larger.
   * Due to the interpixel location at lowest levels it needs to be bigger by
   * the max value that can be. (SCALE_FACTOR)
   *
   * @param dim
   * @return
   */

  function getRequiredDim(dim) {
    return dim + BLUR_EDGE + SCALE_FACTOR;
  }

  //Function inserts the values into the given ints array (pass by reference)
  //The results will be within 0-255 assuming the requested iterations are 7.
  function olsennoise(ints, stride, x_within_field, y_within_field, width, height, iteration) {
    if (iteration == 0) {
      //Base case. If we are at the bottom. Do not run the rest of the function. Return random values.
      clearValues(ints, stride, width, height); //base case needs zero, apply Noise will not eat garbage.
      applyNoise(ints, stride, x_within_field, y_within_field, width, height, iteration);
      return;
    }

    var x_remainder = x_within_field & 1; //Adjust the x_remainder so we know how much more into the pixel are.
    var y_remainder = y_within_field & 1; //Math.abs(y_within_field % SCALE_FACTOR) - Would be assumed for larger scalefactors.

    /*
    Pass the ints, and the stride for that set of ints.
    Recurse the call to the function moving the x_within_field forward if we actaully want half a pixel at the start.
    Same for the requestedY.
    The width should expanded by the x_remainder, and then half the size, with enough extra to store the extra ints from the blur.
    If the width is too long, it'll just run more stuff than it needs to.
    */

    olsennoise(ints, stride,
      (Math.floor((x_within_field + x_remainder) / SCALE_FACTOR)) - x_remainder,
      (Math.floor((y_within_field + y_remainder) / SCALE_FACTOR)) - y_remainder,
      (Math.floor((width + x_remainder) / SCALE_FACTOR)) + BLUR_EDGE,
      (Math.floor((height + y_remainder) / SCALE_FACTOR)) + BLUR_EDGE, iteration - 1);

    //This will scale the image from half the width and half the height. bounds.
    //The scale function assumes you have at least width/2 and height/2 good ints.
    //We requested those from olsennoise above, so we should have that.

    applyScaleShift(ints, stride, width + BLUR_EDGE, height + BLUR_EDGE, SCALE_FACTOR, x_remainder, y_remainder);

    //This applies the blur and uses the given bounds.
    //Since the blur loses two at the edge, this will result
    //in us having width requestedX height of good ints and required
    // width + blurEdge of good ints. height + blurEdge of good ints.
    applyBlur(ints, stride, width + BLUR_EDGE, height + BLUR_EDGE);

    //Applies noise to all the given ints. Does not require more or less than ints. Just offsets them all randomly.
    applyNoise(ints, stride, x_within_field, y_within_field, width, height, iteration);
  }



  function applyNoise(pixels, stride, x_within_field, y_within_field, width, height, iteration) {
    var bitmask = 0b00000001000000010000000100000001 << (7 - iteration);
    var index = 0;
    for (var k = 0, n = height - 1; k <= n; k++, index += stride) { //iterate the requestedY positions. Offsetting the index by stride each time.
      for (var j = 0, m = width - 1; j <= m; j++) { //iterate the requestedX positions through width.
        var current = index + j; // The current position of the pixel is the index which will have added stride each, requestedY iteration
        pixels[current] += hashrandom(j + x_within_field, k + y_within_field, iteration) & bitmask;
        //add on to this pixel the hash function with the set reduction.
        //It simply must scale down with the larger number of iterations.
      }
    }
  }

  function applyScaleShift(pixels, stride, width, height, factor, shiftX, shiftY) {
    var index = (height - 1) * stride; //We must iteration backwards to scale so index starts at last Y position.
    for (var k = 0, n = height - 1; k <= n; n--, index -= stride) { // we iterate the requestedY, removing stride from index.
      for (var j = 0, m = width - 1; j <= m; m--) { // iterate the requestedX positions from width to 0.
        var pos = index + m; //current position is the index (position of that scanline of Y) plus our current iteration in scale.
        var lower = (Math.floor((n + shiftY) / factor) * stride) + Math.floor((m + shiftX) / factor); //We find the position that is half that size. From where we scale them out.
        pixels[pos] = pixels[lower]; // Set the outer position to the inner position. Applying the scale.
      }
    }
  }

  function clearValues(pixels, stride, width, height) {
    var index;
    index = 0;
    for (var k = 0, n = height - 1; k <= n; k++, index += stride) { //iterate the requestedY values.
      for (var j = 0, m = width - 1; j <= m; j++) { //iterate the requestedX values.
        pixels[index + j] = 0; //clears those values.
      }
    }
  }

  //Applies the blur.
  //loopunrolled box blur 3x3 in each color.
  function applyBlur(pixels, stride, width, height) {
    var index = 0;
    var v0;
    var v1;
    var v2;

    var r;
    var g;
    var b;

    for (var j = 0; j < height; j++, index += stride) {
      for (var k = 0; k < width; k++) {
        var pos = index + k;

        v0 = pixels[pos];
        v1 = pixels[pos + 1];
        v2 = pixels[pos + 2];

        r = ((v0 >> 16) & 0xFF) + ((v1 >> 16) & 0xFF) + ((v2 >> 16) & 0xFF);
        g = ((v0 >> 8) & 0xFF) + ((v1 >> 8) & 0xFF) + ((v2 >> 8) & 0xFF);
        b = ((v0) & 0xFF) + ((v1) & 0xFF) + ((v2) & 0xFF);
        r = Math.floor(r / 3);
        g = Math.floor(g / 3);
        b = Math.floor(b / 3);
        pixels[pos] = r << 16 | g << 8 | b;
      }
    }
    index = 0;
    for (var j = 0; j < height; j++, index += stride) {
      for (var k = 0; k < width; k++) {
        var pos = index + k;
        v0 = pixels[pos];
        v1 = pixels[pos + stride];
        v2 = pixels[pos + (stride << 1)];

        r = ((v0 >> 16) & 0xFF) + ((v1 >> 16) & 0xFF) + ((v2 >> 16) & 0xFF);
        g = ((v0 >> 8) & 0xFF) + ((v1 >> 8) & 0xFF) + ((v2 >> 8) & 0xFF);
        b = ((v0) & 0xFF) + ((v1) & 0xFF) + ((v2) & 0xFF);
        r = Math.floor(r / 3);
        g = Math.floor(g / 3);
        b = Math.floor(b / 3);
        pixels[pos] = r << 16 | g << 8 | b;
      }
    }
  }


  function hashrandom(v0, v1, v2) {
    var hash = seed;
    hash ^= v0;
    hash = hashsingle(hash);
    hash ^= v1;
    hash = hashsingle(hash);
    hash ^= v2;
    hash = hashsingle(hash);
    return hash;
  }

  function hashsingle(v) {
    var hash = v;
    var h = hash;

    switch (hash & 3) {
      case 3:
        hash += h;
        hash ^= hash << 32;
        hash ^= h << 36;
        hash += hash >> 22;
        break;
      case 2:
        hash += h;
        hash ^= hash << 22;
        hash += hash >> 34;
        break;
      case 1:
        hash += h;
        hash ^= hash << 20;
        hash += hash >> 2;
    }
    hash ^= hash << 6;
    hash += hash >> 10;
    hash ^= hash << 8;
    hash += hash >> 34;
    hash ^= hash << 50;
    hash += hash >> 12;
    return hash;
  }


  fieldOlsenNoise(iterations, colorvalues, stride, xpos, ypos, width, height);
  const heightmap = nj.zeros([width, height]);

  const getValue = (x, y) => colorvalues[(y * stride) + x];

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const value = getValue(x, y);
      heightmap.set(x, y, value & 0xFF);
    }
  }

  // simple box blur
  for (let x = 1; x < width - 1; x++) {
    for (let y = 1; y < height - 1; y++) {
      const mean = _.mean([
        heightmap.get(x + 1, y + 1),
        heightmap.get(x - 1, y - 1),
        heightmap.get(x - 1, y + 1),
        heightmap.get(x + 1, y - 1),
        heightmap.get(x, y + 1),
        heightmap.get(x + 1, y),
        heightmap.get(x, y - 1),
        heightmap.get(x - 1, y)
      ]);
      heightmap.set(x, y, mean);
    }
  }
  return heightmap;
}
