const W = 512, H = 512;
const SLOW_ITER = 300, FAST_ITER = 4;
const CHAOS_GAMES_SLOW = 3000, CHAOS_GAMES_FAST = 800;

function hsvToRgb(h, s, v) {
  let r, g, b;

  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }

  return {
    r: r * 255,
    g: g * 255,
    b: b * 255,
  };
}

function constrain(v, low, high) {
  return Math.min(Math.max(v, low), high);
}

function map(v, curLow, curHigh, newLow, newHigh) {
  return (v - curLow) / (curHigh - curLow) * (newHigh - newLow) + newLow;
}

class Sketch {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.gfx = this.canvas.getContext('2d');
    this.gfx.width = W;
    this.gfx.height = H;
    this.ff = new FractalFlame(this.gfx);
    this.mouseDown = false;

    this.draw = this.draw.bind(this);
    this.onKeyPress = this.onKeyPress.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);

    this.canvas.addEventListener('keypress', this.onKeyPress);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mousedown', this.onMouseDown);

    document.body.appendChild(this.canvas);

    window.requestAnimationFrame(this.draw);
  }

  draw() {
    if (!this.ff.render) {
      this.ff.update();
    }
    this.ff.display(this.gfx);
    window.requestAnimationFrame(this.draw);
  }

  onKeyPress() {
    this.ff.restart();
  }

  onMouseMove(event) {
    if (!this.mouseDown) {
      return;
    }

    this.ff.restart(event.offsetX, event.offsetY);
  }

  onMouseUp() {
    this.mouseDown = false;
    this.ff.slow();
    this.ff.rerender();
  }

  onMouseDown() {
    this.mouseDown = true;
    this.ff.fast();
  }
}

class FractalFlame {
  constructor() {
    this.len = 3;
    this.functions = [];
    for (let i = 0; i < this.len; i++) {
      this.functions[i] = new FracFunction();
    }
    this.probs = [];
    this.histogram = [];
    for (let i = 0; i < W; i++) {
      this.histogram[i] = [];
      for (let j = 0; j < H; j++) {
        this.histogram[i][j] = [0, 0];
      }
    }
    this.p = [
      Math.random() * W,
      Math.random() * H,
      Math.random(),
    ];
    this.pixelAlpha = [];
    this.pixelHue = [];
    this.logFreq = 0;
    this.gamma = 22;
    this.iters = 0;
    this.render = false;
    this.lx = 1000;
    this.hx = -1000;
    this.ly = 1000;
    this.hy = -1000;
    this.chaosGames = CHAOS_GAMES_SLOW;
    this.maxIters = SLOW_ITER;

    this.calcProbs();
    this.restart(Math.random() * W, Math.random() * H);
  }

  calcProbs() {
    let tot = 0;
    for (let i = 0; i < this.len; i++) {
      this.probs[i] = Math.random() * (1 - tot) / this.len;
      tot += this.probs[i];
    }
  }

  setBounds() {
    let tmp = [this.p[0], this.p[1], this.p[2]];

    for (let k = 0; k < this.chaosGames; k++) {
      let fn =
        this.functions[Math.floor(Math.random() * this.functions.length)];
      tmp = this.calc(fn, tmp);

      if (k > 40) {
        this.hx = Math.max(tmp[0], this.hx);
        this.lx = Math.min(tmp[0], this.lx);
        this.hy = Math.max(tmp[1], this.hy);
        this.ly = Math.min(tmp[1], this.ly);
      }
    }
  }

  iter() {
    let tmp = [this.p[0], this.p[1], this.p[2]];

    for (let k = 0; k < this.chaosGames; k++) {
      let fn =
        this.functions[Math.floor(Math.random() * this.functions.length)];
      tmp = this.calc(fn, tmp);

      if (k > 40) {
        let x = Math.round(
          constrain(map(tmp[0], this.lx, this.hx, 0, W - 1), 0, W - 1));
        let y = Math.round(
          constrain(map(tmp[1], this.ly, this.hy, 0, H - 1), 0, H - 1));

        this.histogram[x][y][0] += 1;
        this.histogram[x][y][1] = (this.histogram[x][y][1] + tmp[2]) / 2;
      }
    }
  }

  calcMax() {
    this.logFreq = 0;
    let freq = 0;
    for (let i = 0; i < this.histogram.length; i++) {
      for (let j = 0; j < this.histogram[i].length; j++) {
        if (this.histogram[i][j][0] > freq) {
          freq = this.histogram[i][j][0];
        }
      }
    }
    this.logFreq = Math.log(freq);
  }

  display(gfx) {
    let imageData = gfx.getImageData(0, 0, W, H);
    for (let i = 0; i < this.histogram.length; i++) {
      for (let j = 0; j < this.histogram[i].length; j++) {
        let cell = this.histogram[i][j];
        let alpha = 0;
        if (cell[0] > 0) {
          alpha = constrain(Math.log(cell[0]) / this.logFreq, 0, 1);
        }
        let hue = constrain(cell[1], 0, 1);
        let {r, g, b} = hsvToRgb(hue, 1, alpha);
        imageData.data[4 * (j * W + i) + 0] = Math.floor(r);
        imageData.data[4 * (j * W + i) + 1] = Math.floor(g);
        imageData.data[4 * (j * W + i) + 2] = Math.floor(b);
        imageData.data[4 * (j * W + i) + 3] = 255;
      }
    }
    gfx.putImageData(imageData, 0, 0);
  }

  update() {
    this.p[0] = Math.random() * W;
    this.p[1] = Math.random() * H;
    this.p[2] = Math.random();

    this.iter();
    this.iters += 1;
    if (this.iters > this.maxIters) {
      this.render = true;
    }
    this.calcMax();
  }

  calc(fn, vals) {
    return fn.fn(vals[0], vals[1], vals[2]);
  }

  restart(mx, my) {
    for (let i = 0; i < this.functions.length; i++) {
      let fn = this.functions[i];
      if (typeof mx === 'undefined') {
        fn.randomCoefs();
      } else {
        fn.setCoefs(
          Math.sin(my / (5.6 + i / 4.4)),
          Math.cos(mx / (52.0 - i) * i / 1.1),
          Math.sin(Math.PI + mx / (90 + i)),
          Math.sin(mx / (7.6 + i / 2.7)),
          Math.cos(mx / (90.0 - i) * i / 1.1),
          Math.sin(Math.PI + mx / (20 + i))
        );
      }
      fn.randomWeights();
    }
    this.rerender();
  }

  fast() {
    this.chaosGames = CHAOS_GAMES_FAST;
    this.maxIters = FAST_ITER;
  }

  slow() {
    this.chaosGames = CHAOS_GAMES_SLOW;
    this.maxIters = SLOW_ITER;
  }

  rerender() {
    this.lx = 1000;
    this.hx = -1000;
    this.ly = 1000;
    this.hy = -1000;

    for (let i = 0; i < FAST_ITER; i++) {
      this.p = [Math.random() * W, Math.random() * H, Math.random()];
      this.setBounds();
    }
    this.render = false;

    for (let i = 0; i < this.histogram.length; i++) {
      for (let j = 0; j < this.histogram[i].length; j++) {
        this.histogram[i][j] = [0, 0];
      }
    }
    this.iters = 0;
  }
}

class FracFunction {
  constructor() {
    this.a = 0;
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.e = 0;
    this.f = 0;
    this.clr = 0;
    this.h = Math.random();
    this.weights = [0, 0, 0];
    this.vars = [sinVar, linVar, sphereVar];

    this.randomCoefs();
    this.randomWeights();
  }

  randomCoefs() {
    this.a = Math.random() * 4 - 2;
    this.b = Math.random() * 4 - 2;
    this.c = Math.random() * 4 - 2;
    this.d = Math.random() * 4 - 2;
    this.e = Math.random() * 4 - 2;
    this.f = Math.random() * 4 - 2;
  }

  setCoefs(a, b, c, d, e, f) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  randomWeights() {
    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] = Math.random();
    }
  }

  fn(x, y, h) {
    let ret = [0, 0, 0];
    for (let i = 0; i < this.vars.length; i++) {
      let tmp = this.vars[i](
        this.a * x + this.b * y + this.c,
        this.d * x + this.e * y + this.f
      );
      for (let j = 0; j < tmp.length; j++) {
        ret[j] += this.weights[i] * tmp[j];
      }
    }
    ret[2] = (h + this.h) / 2;
    return ret;
  }
}

function linVar(m, n) {
  return [m, n];
}

function sinVar(m, n) {
  return [Math.sin(m), Math.sin(n)];
}

function sphereVar(m, n) {
  return [
    m / (m * m + n * n),
    n / (m * m + n * n),
  ];
}

window._sketch = new Sketch();
