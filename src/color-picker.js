/**
 * Dreamanual Color Picker
 * 基于 Canvas 的 HSV 色彩空间取色器
 * 支持 HEX / RGB / HSL / OKLCH 模式
 * OKLCH 通道支持 sRGB gamut clipping 条纹遮罩
 *
 * 独立版本 — 无外部依赖，OKLCH 转换函数已内化
 */

(function() {
  'use strict';

  // ===== OKLCH 色彩空间转换（内化，无外部依赖） =====

  function _toLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function _fromLinear(c) {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  function _matMul(m, v) {
    return [
      m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
      m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
      m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
    ];
  }

  function _cbrt(x) {
    return x >= 0 ? Math.pow(x, 1 / 3) : -Math.pow(-x, 1 / 3);
  }

  function _rgbToXyz(r, g, b) {
    r = _toLinear(r); g = _toLinear(g); b = _toLinear(b);
    return {
      x: (r * 0.4123907993 + g * 0.3575843394 + b * 0.1804807884) * 100,
      y: (r * 0.2126390059 + g * 0.7151686788 + b * 0.0721923154) * 100,
      z: (r * 0.0193308187 + g * 0.1191947798 + b * 0.9505321523) * 100
    };
  }

  function _xyzToRgb(x, y, z) {
    x /= 100; y /= 100; z /= 100;
    var r = x * 3.2409699419 + y * -1.5373831776 + z * -0.4986107603;
    var g = x * -0.9692436363 + y * 1.8759675015 + z * 0.0415550574;
    var b = x * 0.0556300797 + y * -0.2039769589 + z * 1.0569715142;
    r = _fromLinear(r); g = _fromLinear(g); b = _fromLinear(b);
    return {
      r: Math.max(0, Math.min(1, r)),
      g: Math.max(0, Math.min(1, g)),
      b: Math.max(0, Math.min(1, b))
    };
  }

  function _xyzToOklab(x, y, z) {
    var lms = _matMul([
      [0.8189330101, 0.3618667424, -0.1288597137],
      [0.0329845436, 0.9293117519, 0.0361456387],
      [0.0482003018, 0.2643662691, 0.6338517070]
    ], [x / 100, y / 100, z / 100]);
    var lmsP = lms.map(_cbrt);
    var oklab = _matMul([
      [0.2104542553, 0.7936177850, -0.0040720468],
      [1.9779984951, -2.4285922050, 0.4505937099],
      [0.0259040371, 0.7827717662, -0.8086757660]
    ], lmsP);
    return { L: oklab[0], a: oklab[1], b: oklab[2] };
  }

  function _oklabToXyz(L, a, b) {
    var lmsP = _matMul([
      [1.0, 0.3963377774, 0.2158037573],
      [1.0, -0.1055613458, -0.0638541728],
      [1.0, -0.0894841775, -1.2914855480]
    ], [L, a, b]);
    var lms = lmsP.map(function(v) { return v * v * v; });
    var xyz = _matMul([
      [1.2270138511, -0.5577992887, 0.2812561490],
      [-0.0405801784, 1.1122568696, -0.0716766787],
      [-0.0763812845, -0.4214819784, 1.5861632204]
    ], lms);
    return { x: xyz[0] * 100, y: xyz[1] * 100, z: xyz[2] * 100 };
  }

  // 颜色转换工具函数
  var ColorUtils = {
    hexToRgb: function(hex) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      var num = parseInt(hex, 16);
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    },
    rgbToHex: function(r, g, b) {
      return '#' + [r, g, b].map(function(x) {
        var h = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return h.length === 1 ? '0' + h : h;
      }).join('').toUpperCase();
    },
    rgbToHsv: function(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      var h = 0, s = max === 0 ? 0 : d / max, v = max;
      if (d !== 0) {
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return { h: h * 360, s: s, v: v };
    },
    hsvToRgb: function(h, s, v) {
      h = ((h % 360) + 360) % 360 / 360;
      var i = Math.floor(h * 6), f = h * 6 - i;
      var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
      var r, g, b;
      switch (i % 6) {
        case 0: r=v;g=t;b=p; break; case 1: r=q;g=v;b=p; break;
        case 2: r=p;g=v;b=t; break; case 3: r=p;g=q;b=v; break;
        case 4: r=t;g=p;b=v; break; case 5: r=v;g=p;b=q; break;
      }
      return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
    },
    rgbToHsl: function(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      var h = 0, s = 0, l = (max + min) / 2;
      if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
    },
    hslToRgb: function(h, s, l) {
      h /= 360; s /= 100; l /= 100;
      var r, g, b;
      if (s === 0) { r = g = b = l; }
      else {
        var hue2rgb = function(p, q, t) {
          if (t < 0) t += 1; if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
    }
  };

  // OKLCH 转换（内化版本，直接使用上方辅助函数）
  var OklchUtils = {
    rgbToOklch: function(r, g, b) {
      var xyz = _rgbToXyz(r / 255, g / 255, b / 255);
      var oklab = _xyzToOklab(xyz.x, xyz.y, xyz.z);
      var c = Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b);
      var h = c < 0.0001 ? 0 : (Math.atan2(oklab.b, oklab.a) * 180 / Math.PI + 360) % 360;
      return { l: oklab.L * 100, c: c, h: h };
    },
    oklchToRgb: function(l, c, h) {
      var a_ = c * Math.cos(h * Math.PI / 180);
      var b_ = c * Math.sin(h * Math.PI / 180);
      var xyz = _oklabToXyz(l / 100, a_, b_);
      var rgb = _xyzToRgb(xyz.x, xyz.y, xyz.z);
      return { r: Math.round(rgb.r * 255), g: Math.round(rgb.g * 255), b: Math.round(rgb.b * 255) };
    }
  };

  // 通道定义
  var CHANNEL_DEFS = {
    rgb: [
      { key: 'r', label: 'R', min: 0, max: 255, step: 1 },
      { key: 'g', label: 'G', min: 0, max: 255, step: 1 },
      { key: 'b', label: 'B', min: 0, max: 255, step: 1 }
    ],
    hsl: [
      { key: 'h_hsl', label: 'H', min: 0, max: 360, step: 1 },
      { key: 's_hsl', label: 'S', min: 0, max: 100, step: 1 },
      { key: 'l_hsl', label: 'L', min: 0, max: 100, step: 1 }
    ],
    oklch: [
      { key: 'l_oklch', label: 'L', min: 0, max: 100, step: 0.1 },
      { key: 'c_oklch', label: 'C', min: 0, max: 0.5, step: 0.001 },
      { key: 'h_oklch', label: 'H', min: 0, max: 360, step: 1 }
    ]
  };

  // ===== sRGB gamut 检测 =====
  // 通过 OKLCH→OKLab→XYZ→线性sRGB 数学计算
  function isInSrgbGamut(l, c, h) {
    var a_ = c * Math.cos(h * Math.PI / 180);
    var b_ = c * Math.sin(h * Math.PI / 180);
    var xyz = _oklabToXyz(l / 100, a_, b_);
    var x = xyz.x / 100, y = xyz.y / 100, z = xyz.z / 100;
    var r = x * 3.2409699419 + y * -1.5373831776 + z * -0.4986107603;
    var g = x * -0.9692436363 + y * 1.8759675015 + z * 0.0415550574;
    var b = x * 0.0556300797 + y * -0.2039769589 + z * 1.0569715142;
    var eps = 0.002;
    return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
  }

  // ===== 统一 OKLCH gamut 边界计算 =====
  var MIN_ISLAND_DEG = 15;

  function getGamutBoundaries(chKey, currentL, currentC, currentH) {
    var isH = (chKey === 'h_oklch');
    var chMin, chMax;
    if (chKey === 'l_oklch') { chMin = 0; chMax = 100; }
    else if (chKey === 'c_oklch') { chMin = 0; chMax = 0.5; }
    else { chMin = 0; chMax = 360; }

    function check(v) {
      if (chKey === 'l_oklch') return isInSrgbGamut(v, currentC, currentH);
      if (chKey === 'c_oklch') return isInSrgbGamut(currentL, v, currentH);
      return isInSrgbGamut(currentL, currentC, v);
    }

    var SCAN = 72;
    var samples = [];
    for (var i = 0; i <= SCAN; i++) {
      var v = chMin + (i / SCAN) * (chMax - chMin);
      if (isH && i === SCAN) v = 359.9;
      samples.push({ v: v, inGamut: check(v) });
    }

    var edges = [];
    for (var i = 0; i < samples.length; i++) {
      var prev = i > 0 ? samples[i - 1] : (isH ? samples[samples.length - 1] : null);
      var cur = samples[i];
      if (!prev || prev.inGamut === cur.inGamut) continue;
      var eLo = prev.v, eHi = cur.v;
      if (eLo > eHi) eHi += (chMax - chMin);
      for (var j = 0; j < 20; j++) {
        var eMid = (eLo + eHi) / 2;
        var eMidNorm = isH ? (eMid % 360) : eMid;
        if (check(eMidNorm) === prev.inGamut) eLo = eMid; else eHi = eMid;
      }
      var edgeV = cur.inGamut ? (eHi % (isH ? 360 : chMax + 1)) : (eLo % (isH ? 360 : chMax + 1));
      edges.push({ v: Math.round(edgeV * 1000) / 1000, isIncoming: cur.inGamut });
    }

    if (isH && edges.length >= 2) {
      var skipIndices = {};
      for (var i = 0; i < edges.length; i++) {
        if (!edges[i].isIncoming) continue;
        var outIdx = -1;
        for (var j = 1; j < edges.length; j++) {
          var idx = (i + j) % edges.length;
          if (!edges[idx].isIncoming) { outIdx = idx; break; }
        }
        if (outIdx >= 0) {
          var islandWidth = edges[outIdx].v - edges[i].v;
          if (islandWidth < 0) islandWidth += 360;
          if (islandWidth < MIN_ISLAND_DEG) {
            skipIndices[i] = true;
            skipIndices[outIdx] = true;
          }
        }
      }
      var filtered = [];
      for (var i = 0; i < edges.length; i++) {
        if (!skipIndices[i]) filtered.push(edges[i]);
      }
      edges = filtered;
    }

    var segments = [];
    if (edges.length === 0) {
      if (samples.length > 0 && samples[0].inGamut) {
        segments.push({ lo: chMin, hi: chMax });
      }
    } else if (isH) {
      for (var i = 0; i < edges.length; i++) {
        if (!edges[i].isIncoming) continue;
        var outIdx = -1;
        for (var j = 1; j < edges.length; j++) {
          var idx = (i + j) % edges.length;
          if (!edges[idx].isIncoming) { outIdx = idx; break; }
        }
        if (outIdx >= 0) {
          segments.push({ lo: edges[i].v, hi: edges[outIdx].v });
        }
      }
    } else {
      if (edges.length > 0 && !edges[0].isIncoming) {
        segments.push({ lo: chMin, hi: edges[0].v });
      }
      for (var i = 0; i < edges.length; i++) {
        if (!edges[i].isIncoming) continue;
        var outIdx = -1;
        for (var j = i + 1; j < edges.length; j++) {
          if (!edges[j].isIncoming) { outIdx = j; break; }
        }
        if (outIdx >= 0) {
          segments.push({ lo: edges[i].v, hi: edges[outIdx].v });
        } else {
          segments.push({ lo: edges[i].v, hi: chMax });
        }
      }
    }

    return { segments: segments, isH: isH, chMin: chMin, chMax: chMax, edges: edges };
  }

  function isInGamutSegments(segments, val, isH) {
    for (var i = 0; i < segments.length; i++) {
      if (isH) {
        if (segments[i].lo <= segments[i].hi) {
          if (val >= segments[i].lo && val <= segments[i].hi) return true;
        } else {
          if (val >= segments[i].lo || val <= segments[i].hi) return true;
        }
      } else {
        if (val >= segments[i].lo && val <= segments[i].hi) return true;
      }
    }
    return false;
  }

  function getOklchClipRanges(chKey, currentL, currentC, currentH) {
    var bounds = getGamutBoundaries(chKey, currentL, currentC, currentH);
    var segments = bounds.segments;
    var chMin = bounds.chMin, chMax = bounds.chMax, isH = bounds.isH;

    if (segments.length === 0) return 'full';

    var totalRange = chMax - chMin;
    var outRanges = [];
    var sorted = segments.slice().sort(function(a, b) { return a.lo - b.lo; });

    if (!isH) {
      if (sorted[0].lo > chMin) outRanges.push([chMin, sorted[0].lo]);
      for (var i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1].lo > sorted[i].hi) outRanges.push([sorted[i].hi, sorted[i + 1].lo]);
      }
      if (sorted[sorted.length - 1].hi < chMax) outRanges.push([sorted[sorted.length - 1].hi, chMax]);
    } else {
      var SCAN = 72;
      var inRange = [];
      for (var i = 0; i <= SCAN; i++) {
        var v = (i / SCAN) * 360;
        if (i === SCAN) v = 359.9;
        inRange.push({ v: v, inGamut: isInGamutSegments(segments, v, true) });
      }
      var start = null;
      for (var i = 0; i < inRange.length; i++) {
        if (!inRange[i].inGamut) {
          if (start === null) start = inRange[i].v;
        } else {
          if (start !== null) { outRanges.push([start, inRange[i].v]); start = null; }
        }
      }
      if (start !== null) outRanges.push([start, 360]);
    }

    if (outRanges.length === 0) return 'none';

    var pctRanges = [];
    for (var i = 0; i < outRanges.length; i++) {
      pctRanges.push([
        ((outRanges[i][0] - chMin) / totalRange) * 100,
        ((outRanges[i][1] - chMin) / totalRange) * 100
      ]);
    }
    return pctRanges;
  }

  // ===== 取色器类 =====
  class ColorPicker {
    constructor(options) {
      this.options = Object.assign({
        onChange: null,
        onClose: null,
        initialColor: '#3B82F6'
      }, options);

      this.state = { h: 210, s: 0.76, v: 0.96, mode: 'rgb', isOpen: false,
        oklch: { l: 54.0, c: 0.207, h: 259.6 } };
      this.elements = {};
      this.dragTarget = null;
      this.sliderDrag = null;

      this.init();
    }

    init() {
      this.createDOM();
      this.attachEvents();
      this.setColor(this.options.initialColor);
    }

    createDOM() {
      var container = document.createElement('div');
      container.className = 'cp-color-picker';
      container.innerHTML =
        '<div class="cp-picker-top">' +
          '<div class="cp-sv-container" id="cpSvContainer">' +
            '<canvas class="cp-sv-canvas" id="cpSvCanvas" width="308" height="165"></canvas>' +
            '<div class="cp-sv-handle" id="cpSvHandle"></div>' +
          '</div>' +
          '<div class="cp-hue-container" id="cpHueContainer">' +
            '<canvas class="cp-hue-canvas" id="cpHueCanvas" width="308" height="16"></canvas>' +
            '<div class="cp-hue-handle" id="cpHueHandle"></div>' +
          '</div>' +
        '</div>' +
        '<div class="cp-header">' +
          '<button class="cp-eyedropper" id="cpEyedropper" title="Eyedropper">' +
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><g><path d="M18.008 2.228C17.014 2.228 16.009 2.571 15.289 3.29L11.008 7.572 10.727 7.29C10.534 7.105 10.275 7.004 10.008 7.009 9.752 7.009 9.484 7.095 9.289 7.289 8.898 7.689 8.898 8.328 9.289 8.728L10.07 9.508 3.29 16.29C3.18 16.4 3.12 16.55 3.07 16.697L2.07 19.697C1.95 20.055 2.021 20.459 2.29 20.727L3.29 21.727C3.557 21.995 3.961 22.065 4.32 21.947L7.32 20.947C7.468 20.897 7.617 20.837 7.727 20.727L14.508 13.947 15.289 14.727C15.679 15.118 16.336 15.118 16.727 14.727 17.117 14.337 17.117 13.681 16.727 13.289L16.445 13.009 20.727 8.728C22.167 7.288 22.167 4.731 20.727 3.29 20.007 2.57 19.002 2.228 18.008 2.228ZM11.508 10.947 13.071 12.54 6.414 19.165 4.32 19.884 4.164 19.727C4.394 19.038 4.688 18.093 4.852 17.602L11.508 10.947Z" fill="currentColor" fill-opacity="1"/></g></svg>' +
          '</button>' +
          '<div class="cp-current-preview" id="cpCurrentPreview"></div>' +
          '<div class="cp-mode-toggle" id="cpModeToggle" title="Switch mode">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cp-toggle-icon"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>' +
            '<span class="cp-toggle-label" id="cpModeLabel">RGB</span>' +
          '</div>' +
        '</div>' +
        '<div class="cp-channels" id="cpChannels"></div>' +
        '<div class="cp-gamut-hint" id="cpGamutHint">' +
          '<div class="cp-gamut-hint-bar"></div>' +
          '<span>Grayed areas are out of sRGB gamut</span>' +
        '</div>' +
        '<div class="cp-hex-row hidden" id="cpHexRow">' +
          '<div class="cp-hex-group">' +
            '<span class="cp-hex-hash">#</span>' +
            '<input type="text" class="cp-hex-input" id="cpHex" value="3B82F6" maxlength="6">' +
          '</div>' +
        '</div>';

      document.body.appendChild(container);
      this.elements = {
        container: container,
        svCanvas: container.querySelector('#cpSvCanvas'),
        svContainer: container.querySelector('#cpSvContainer'),
        svHandle: container.querySelector('#cpSvHandle'),
        hueCanvas: container.querySelector('#cpHueCanvas'),
        hueContainer: container.querySelector('#cpHueContainer'),
        hueHandle: container.querySelector('#cpHueHandle'),
        currentPreview: container.querySelector('#cpCurrentPreview'),
        eyedropper: container.querySelector('#cpEyedropper'),
        modeToggle: container.querySelector('#cpModeToggle'),
        modeLabel: container.querySelector('#cpModeLabel'),
        channelsContainer: container.querySelector('#cpChannels'),
        hexInput: container.querySelector('#cpHex'),
        hexRow: container.querySelector('#cpHexRow'),
        inputs: {},
        sliders: {}
      };

      this._buildSliders();
    }

    _buildSliders() {
      var channelsEl = this.elements.channelsContainer;
      channelsEl.innerHTML = '';
      var allModes = ['rgb', 'hsl', 'oklch'];

      for (var mi = 0; mi < allModes.length; mi++) {
        var mode = allModes[mi];
        var channels = CHANNEL_DEFS[mode];

        for (var ci = 0; ci < channels.length; ci++) {
          var ch = channels[ci];
          var row = document.createElement('div');
          row.className = 'cp-slider-row' + (mode !== this.state.mode ? ' hidden' : '');
          row.dataset.mode = mode;

          row.innerHTML =
            '<span class="cp-slider-label">' + ch.label + '</span>' +
            '<div class="cp-slider-track" data-key="' + ch.key + '">' +
              '<div class="cp-slider-handle" id="cpHandle_' + ch.key + '"></div>' +
              '<div class="cp-slider-clip" id="cpClip_' + ch.key + '"></div>' +
            '</div>' +
            '<input type="number" class="cp-slider-input" id="cpIn_' + ch.key + '" ' +
              'min="' + ch.min + '" max="' + ch.max + '" step="' + ch.step + '" value="0">';

          channelsEl.appendChild(row);

          this.elements.inputs[ch.key] = row.querySelector('#cpIn_' + ch.key);
          this.elements.sliders[ch.key] = {
            track: row.querySelector('.cp-slider-track'),
            handle: row.querySelector('#cpHandle_' + ch.key),
            clip: row.querySelector('#cpClip_' + ch.key),
            input: row.querySelector('#cpIn_' + ch.key),
            row: row
          };
        }
      }
    }

    attachEvents() {
      var self = this;
      this.elements.svContainer.addEventListener('mousedown', function(e) { self.onSvStart(e); });
      document.addEventListener('mousemove', function(e) { self.onGenericMove(e); });
      document.addEventListener('mouseup', function() { self.onGenericEnd(); });

      this.elements.hueContainer.addEventListener('mousedown', function(e) { self.onHueStart(e); });
      this.elements.channelsContainer.addEventListener('mousedown', function(e) { self.onSliderMouseDown(e); });

      var allKeys = Object.keys(this.elements.inputs);
      for (var i = 0; i < allKeys.length; i++) {
        (function(key) {
          self.elements.inputs[key].addEventListener('input', function() { self.onInputChange(); });
          self.elements.inputs[key].addEventListener('blur', function() {
            self.updateUI(self.state.mode === 'oklch');
          });
          self.elements.inputs[key].addEventListener('keydown', function(e) { if (e.key === 'Enter') self.close(); });
        })(allKeys[i]);
      }

      this.elements.hexInput.addEventListener('input', function() { self.onHexInput(); });
      this.elements.hexInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') self.close(); });
      this.elements.modeToggle.addEventListener('click', function() { self.toggleMode(); });
      this.elements.eyedropper.addEventListener('click', function() { self.useEyedropper(); });

      document.addEventListener('click', function(e) {
        if (self.state.isOpen && !self.elements.container.contains(e.target) &&
            !e.target.closest('.cp-anchor')) {
          self.close();
        }
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && self.state.isOpen) self.close();
      });
    }

    onSvStart(e) { e.preventDefault(); this.dragTarget = 'sv'; this._updateSvFromEvent(e); }
    onHueStart(e) { e.preventDefault(); this.dragTarget = 'hue'; this._updateHueFromEvent(e); }
    onSliderMouseDown(e) {
      var trackEl = e.target.closest('.cp-slider-track');
      if (!trackEl) return;
      e.preventDefault();
      this.sliderDrag = trackEl.dataset.key;
      this._updateSliderFromEvent(this.sliderDrag, e);
    }

    onGenericMove(e) {
      if (this.dragTarget === 'sv') { e.preventDefault(); this._updateSvFromEvent(e); }
      else if (this.dragTarget === 'hue') { e.preventDefault(); this._updateHueFromEvent(e); }
      else if (this.sliderDrag) { e.preventDefault(); this._updateSliderFromEvent(this.sliderDrag, e); }
    }

    onGenericEnd() { this.dragTarget = null; this.sliderDrag = null; }

    _updateSvFromEvent(e) {
      var rect = this.elements.svCanvas.getBoundingClientRect();
      this.state.s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.state.v = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      this.updateUI();
    }

    _updateHueFromEvent(e) {
      var rect = this.elements.hueCanvas.getBoundingClientRect();
      this.state.h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
      this.updateUI();
    }

    _updateSliderFromEvent(key, e) {
      var slider = this.elements.sliders[key];
      if (!slider) return;
      var rect = slider.track.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      var chDef = this._getChannelDef(key);
      if (!chDef) return;
      var val = chDef.min + ratio * (chDef.max - chDef.min);
      val = Math.round(val / chDef.step) * chDef.step;
      val = Math.max(chDef.min, Math.min(chDef.max, parseFloat(val.toFixed(6))));
      if (this.state.mode === 'oklch') val = this._clampToGamut(key, val);
      this._lastSliderKey = key;
      this.elements.inputs[key].value = val;
      this.onInputChange();
      this._lastSliderKey = null;
    }

    _clampToGamut(key, val) {
      var ol = this.state.oklch.l, oc = this.state.oklch.c, oh = this.state.oklch.h;
      var chDef = this._getChannelDef(key);
      var step = chDef ? chDef.step : 1;
      var bounds = getGamutBoundaries(key, ol, oc, oh);
      var segments = bounds.segments;
      var isH = bounds.isH;
      var chMin = bounds.chMin, chMax = bounds.chMax;

      if (segments.length === 0) return val;
      if (isInGamutSegments(segments, val, isH)) return val;

      if (isH) {
        var bestDist = Infinity, bestVal = val;
        for (var i = 0; i < segments.length; i++) {
          var dLo = Math.abs(val - segments[i].lo);
          if (dLo > 180) dLo = 360 - dLo;
          var dHi = Math.abs(val - segments[i].hi);
          if (dHi > 180) dHi = 360 - dHi;
          if (dLo < bestDist) { bestDist = dLo; bestVal = segments[i].lo; }
          if (dHi < bestDist) { bestDist = dHi; bestVal = segments[i].hi; }
        }
        bestVal = Math.round(bestVal / step) * step;
        return Math.max(chMin, Math.min(chMax, parseFloat(bestVal.toFixed(6))));
      }

      var lowerBound = null, upperBound = null;
      for (var i = 0; i < segments.length; i++) {
        if (segments[i].lo <= val) {
          if (lowerBound === null || segments[i].lo > lowerBound) lowerBound = segments[i].lo;
        } else {
          if (upperBound === null || segments[i].lo < upperBound) upperBound = segments[i].lo;
        }
        if (segments[i].hi < val) {
          if (lowerBound === null || segments[i].hi > lowerBound) lowerBound = segments[i].hi;
        } else if (segments[i].hi > val) {
          if (upperBound === null || segments[i].hi < upperBound) upperBound = segments[i].hi;
        }
      }

      if (lowerBound === null && upperBound === null) return val;
      if (lowerBound === null) return parseFloat((Math.round(upperBound / step) * step).toFixed(6));
      if (upperBound === null) return parseFloat((Math.round(lowerBound / step) * step).toFixed(6));

      var result;
      if (val - lowerBound <= upperBound - val) result = lowerBound;
      else result = upperBound;
      result = Math.round(result / step) * step;
      return Math.max(chMin, Math.min(chMax, parseFloat(result.toFixed(6))));
    }

    _getChannelDef(key) {
      var modes = Object.keys(CHANNEL_DEFS);
      for (var i = 0; i < modes.length; i++) {
        var chs = CHANNEL_DEFS[modes[i]];
        for (var j = 0; j < chs.length; j++) {
          if (chs[j].key === key) return chs[j];
        }
      }
      return null;
    }

    drawSvCanvas() {
      var canvas = this.elements.svCanvas, ctx = canvas.getContext('2d');
      var w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      var gH = ctx.createLinearGradient(0, 0, w, 0);
      gH.addColorStop(0, '#fff');
      gH.addColorStop(1, 'hsl(' + this.state.h + ',100%,50%)');
      ctx.fillStyle = gH; ctx.fillRect(0, 0, w, h);
      var gV = ctx.createLinearGradient(0, 0, 0, h);
      gV.addColorStop(0, 'transparent');
      gV.addColorStop(1, '#000');
      ctx.fillStyle = gV; ctx.fillRect(0, 0, w, h);
    }

    drawHueCanvas() {
      var canvas = this.elements.hueCanvas, ctx = canvas.getContext('2d');
      var w = canvas.width, h = canvas.height;
      var g = ctx.createLinearGradient(0, 0, w, 0);
      for (var i = 0; i <= 6; i++) g.addColorStop(i / 6, 'hsl(' + (i * 60) + ',100%,50%)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }

    _getSliderGradient(key) {
      var rgb = ColorUtils.hsvToRgb(this.state.h, this.state.s, this.state.v);
      var hsl = ColorUtils.rgbToHsl(rgb.r, rgb.g, rgb.b);
      var oklch = this.state.mode === 'oklch' ? this.state.oklch : OklchUtils.rgbToOklch(rgb.r, rgb.g, rgb.b);

      if (key === 'r' || key === 'g' || key === 'b') {
        var idx = key === 'r' ? 0 : key === 'g' ? 1 : 2;
        var vals = [rgb.r, rgb.g, rgb.b];
        var s = vals.slice(), e = vals.slice(); s[idx] = 0; e[idx] = 255;
        return 'linear-gradient(to right, rgb(' + s.join(',') + '), rgb(' + e.join(',') + '))';
      }

      var hh, ss, ll;
      if (key === 'h_hsl' || key === 's_hsl' || key === 'l_hsl') {
        hh = hsl.h; ss = hsl.s; ll = hsl.l;
        if (key === 'h_hsl') return 'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))';
        if (key === 's_hsl') return 'linear-gradient(to right, hsl(' + hh + ',0%,' + ll + '%), hsl(' + hh + ',100%,' + ll + '%))';
        return 'linear-gradient(to right, hsl(' + hh + ',' + ss + '%,0%), hsl(' + hh + ',' + ss + '%,50%), hsl(' + hh + ',' + ss + '%,100%))';
      }

      if (key === 'l_oklch' || key === 'c_oklch' || key === 'h_oklch') {
        var ol = oklch.l, oc = oklch.c, oh = oklch.h;
        if (key === 'l_oklch') {
          var r0 = OklchUtils.oklchToRgb(0, oc, oh);
          var r50 = OklchUtils.oklchToRgb(50, oc, oh);
          var r100 = OklchUtils.oklchToRgb(100, oc, oh);
          return 'linear-gradient(to right, rgb(' + r0.r + ',' + r0.g + ',' + r0.b + '), rgb(' + r50.r + ',' + r50.g + ',' + r50.b + '), rgb(' + r100.r + ',' + r100.g + ',' + r100.b + '))';
        }
        if (key === 'c_oklch') {
          var steps = [];
          for (var i = 0; i <= 8; i++) {
            var cr = OklchUtils.oklchToRgb(ol, (i / 8) * 0.5, oh);
            steps.push('rgb(' + cr.r + ',' + cr.g + ',' + cr.b + ')');
          }
          return 'linear-gradient(to right, ' + steps.join(', ') + ')';
        }
        var hSteps = [];
        for (var j = 0; j <= 12; j++) {
          var hr = OklchUtils.oklchToRgb(ol, oc, (j / 12) * 360);
          hSteps.push('rgb(' + hr.r + ',' + hr.g + ',' + hr.b + ')');
        }
        return 'linear-gradient(to right, ' + hSteps.join(', ') + ')';
      }

      return 'linear-gradient(to right, #ccc, #333)';
    }

    _updateClipMasks() {
      if (this.state.mode !== 'oklch') {
        var keys = Object.keys(this.elements.sliders);
        for (var i = 0; i < keys.length; i++) {
          var sl = this.elements.sliders[keys[i]];
          if (sl.clip) sl.clip.innerHTML = '';
        }
        return;
      }

      var ol = this.state.oklch.l, oc = this.state.oklch.c, oh = this.state.oklch.h;
      var keys2 = ['l_oklch', 'c_oklch', 'h_oklch'];

      for (var j = 0; j < keys2.length; j++) {
        var sl2 = this.elements.sliders[keys2[j]];
        if (!sl2 || !sl2.clip) continue;
        var ranges = getOklchClipRanges(keys2[j], ol, oc, oh);
        sl2.clip.innerHTML = '';
        if (ranges === 'none') continue;

        if (ranges === 'full') {
          var region = document.createElement('div');
          region.className = 'cp-slider-clip-region';
          region.style.left = '0%';
          region.style.width = '100%';
          sl2.clip.appendChild(region);
        } else {
          for (var k = 0; k < ranges.length; k++) {
            var region = document.createElement('div');
            region.className = 'cp-slider-clip-region';
            region.style.left = ranges[k][0].toFixed(1) + '%';
            region.style.width = (ranges[k][1] - ranges[k][0]).toFixed(1) + '%';
            sl2.clip.appendChild(region);
          }
        }
      }
    }

    _updateSliders() {
      var allKeys = Object.keys(this.elements.sliders);
      for (var i = 0; i < allKeys.length; i++) {
        var key = allKeys[i];
        var slider = this.elements.sliders[key];
        var chDef = this._getChannelDef(key);
        if (!chDef) continue;
        slider.track.style.background = this._getSliderGradient(key);
        var val = parseFloat(this.elements.inputs[key].value) || 0;
        var ratio = Math.max(0, Math.min(1, (val - chDef.min) / (chDef.max - chDef.min)));
        slider.handle.style.left = (ratio * 100) + '%';
      }
      this._updateClipMasks();
    }

    updateUI(oklchFromSlider) {
      var rgb = ColorUtils.hsvToRgb(this.state.h, this.state.s, this.state.v);
      var hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
      var hsl = ColorUtils.rgbToHsl(rgb.r, rgb.g, rgb.b);
      var oklch;
      if (this.state.mode === 'oklch' && oklchFromSlider) {
        oklch = this.state.oklch;
      } else {
        oklch = OklchUtils.rgbToOklch(rgb.r, rgb.g, rgb.b);
        this.state.oklch = { l: oklch.l, c: oklch.c, h: oklch.h };
      }

      this.elements.currentPreview.style.background = hex;
      this.drawSvCanvas();

      var svW = this.elements.svContainer.offsetWidth;
      var svH = this.elements.svContainer.offsetHeight;
      this.elements.svHandle.style.left = (this.state.s * svW) + 'px';
      this.elements.svHandle.style.top = ((1 - this.state.v) * svH) + 'px';
      this.elements.svHandle.style.background = hex;

      var hueW = this.elements.hueContainer.offsetWidth;
      this.elements.hueHandle.style.left = ((this.state.h / 360) * hueW) + 'px';

      if (document.activeElement !== this.elements.inputs.r) this.elements.inputs.r.value = rgb.r;
      if (document.activeElement !== this.elements.inputs.g) this.elements.inputs.g.value = rgb.g;
      if (document.activeElement !== this.elements.inputs.b) this.elements.inputs.b.value = rgb.b;
      if (document.activeElement !== this.elements.inputs.h_hsl) this.elements.inputs.h_hsl.value = hsl.h;
      if (document.activeElement !== this.elements.inputs.s_hsl) this.elements.inputs.s_hsl.value = hsl.s;
      if (document.activeElement !== this.elements.inputs.l_hsl) this.elements.inputs.l_hsl.value = hsl.l;
      if (document.activeElement !== this.elements.inputs.l_oklch) this.elements.inputs.l_oklch.value = oklch.l.toFixed(1);
      if (document.activeElement !== this.elements.inputs.c_oklch) this.elements.inputs.c_oklch.value = oklch.c.toFixed(3);
      if (document.activeElement !== this.elements.inputs.h_oklch) this.elements.inputs.h_oklch.value = oklch.h.toFixed(1);
      if (document.activeElement !== this.elements.hexInput) this.elements.hexInput.value = hex.replace('#', '');

      var modeLabels = { rgb: 'RGB', hsl: 'HSL', oklch: 'OKLCH', hex: 'HEX' };
      if (this.elements.modeLabel) this.elements.modeLabel.textContent = modeLabels[this.state.mode];

      this._updateSliders();

      if (this.options.onChange) {
        this.options.onChange(hex, rgb, hsl, { h: this.state.h, s: this.state.s, v: this.state.v });
      }
    }

    onInputChange() {
      var r, g, b, h, s, l, rgb;
      var oklchFromSlider = false;
      if (this.state.mode === 'rgb') {
        r = parseInt(this.elements.inputs.r.value) || 0;
        g = parseInt(this.elements.inputs.g.value) || 0;
        b = parseInt(this.elements.inputs.b.value) || 0;
        var hsv = ColorUtils.rgbToHsv(r, g, b);
        this.state.h = hsv.h; this.state.s = hsv.s; this.state.v = hsv.v;
      } else if (this.state.mode === 'hsl') {
        h = parseInt(this.elements.inputs.h_hsl.value) || 0;
        s = parseInt(this.elements.inputs.s_hsl.value) || 0;
        l = parseInt(this.elements.inputs.l_hsl.value) || 0;
        rgb = ColorUtils.hslToRgb(h, s, l);
        var hsv2 = ColorUtils.rgbToHsv(rgb.r, rgb.g, rgb.b);
        this.state.h = hsv2.h; this.state.s = hsv2.s; this.state.v = hsv2.v;
      } else if (this.state.mode === 'oklch') {
        var okl = parseFloat(this.elements.inputs.l_oklch.value) || 0;
        var okc = parseFloat(this.elements.inputs.c_oklch.value) || 0;
        var okh = parseFloat(this.elements.inputs.h_oklch.value) || 0;
        var changedKey = this._lastSliderKey || null;
        if (changedKey) {
          if (changedKey === 'l_oklch') { okc = this.state.oklch.c; okh = this.state.oklch.h; }
          else if (changedKey === 'c_oklch') { okl = this.state.oklch.l; okh = this.state.oklch.h; }
          else { okl = this.state.oklch.l; okc = this.state.oklch.c; }
          this.state.oklch = { l: okl, c: okc, h: okh };
        } else {
          var changedKey2 = null;
          if (parseFloat(okl.toFixed(4)) !== parseFloat(this.state.oklch.l.toFixed(4))) changedKey2 = 'l_oklch';
          else if (parseFloat(okc.toFixed(4)) !== parseFloat(this.state.oklch.c.toFixed(4))) changedKey2 = 'c_oklch';
          else if (parseFloat(okh.toFixed(4)) !== parseFloat(this.state.oklch.h.toFixed(4))) changedKey2 = 'h_oklch';

          if (changedKey2) {
            if (changedKey2 === 'l_oklch') { okl = this._clampToGamut('l_oklch', okl); okc = this.state.oklch.c; okh = this.state.oklch.h; }
            else if (changedKey2 === 'c_oklch') { okl = this.state.oklch.l; okc = this._clampToGamut('c_oklch', okc); okh = this.state.oklch.h; }
            else { okl = this.state.oklch.l; okc = this.state.oklch.c; okh = this._clampToGamut('h_oklch', okh); }
          } else {
            okl = this.state.oklch.l; okc = this.state.oklch.c; okh = this.state.oklch.h;
          }
          this.state.oklch = { l: okl, c: okc, h: okh };
        }
        rgb = OklchUtils.oklchToRgb(okl, okc, okh);
        var hsv4 = ColorUtils.rgbToHsv(rgb.r, rgb.g, rgb.b);
        this.state.h = hsv4.h; this.state.s = hsv4.s; this.state.v = hsv4.v;
        oklchFromSlider = true;
      }
      this.updateUI(oklchFromSlider);
    }

    onHexInput() {
      var hex = this.elements.hexInput.value;
      if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
        var rgb = ColorUtils.hexToRgb('#' + hex);
        var hsv = ColorUtils.rgbToHsv(rgb.r, rgb.g, rgb.b);
        this.state.h = hsv.h; this.state.s = hsv.s; this.state.v = hsv.v;
        this.updateUI();
      }
    }

    toggleMode() {
      var modes = ['rgb', 'hsl', 'oklch', 'hex'];
      this.state.mode = modes[(modes.indexOf(this.state.mode) + 1) % modes.length];
      var modeLabels = { rgb: 'RGB', hsl: 'HSL', oklch: 'OKLCH', hex: 'HEX' };
      this.elements.modeLabel.textContent = modeLabels[this.state.mode];
      this.elements.container.dataset.mode = this.state.mode;
      var self = this;
      this.elements.channelsContainer.querySelectorAll('.cp-slider-row[data-mode]').forEach(function(el) {
        el.classList.toggle('hidden', el.dataset.mode !== self.state.mode);
      });
      this.elements.hexRow.classList.toggle('hidden', this.state.mode !== 'hex');
      this.updateUI();
    }

    async useEyedropper() {
      if ('EyeDropper' in window) {
        try { var result = await new EyeDropper().open(); this.setColor(result.sRGBHex); }
        catch (e) { /* user cancelled */ }
      } else {
        alert('EyeDropper API is not supported in this browser. Please use Chrome or Edge.');
      }
    }

    setColor(hex) {
      if (!hex || typeof hex !== 'string') return;
      if (!hex.startsWith('#')) hex = '#' + hex;
      try {
        var rgb = ColorUtils.hexToRgb(hex);
        var hsv = ColorUtils.rgbToHsv(rgb.r, rgb.g, rgb.b);
        this.state.h = hsv.h; this.state.s = hsv.s; this.state.v = hsv.v;
        this.updateUI();
      } catch (e) { console.error('Invalid color:', hex); }
    }

    getColor() {
      var rgb = ColorUtils.hsvToRgb(this.state.h, this.state.s, this.state.v);
      return ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    open(anchorEl, initialColor) {
      if (initialColor) this.setColor(initialColor);
      var rect = anchorEl.getBoundingClientRect();
      var left = rect.left, top = rect.bottom + 8;
      if (left + 340 > window.innerWidth) left = rect.right - 340;
      if (top + 420 > window.innerHeight) top = rect.top - 420;
      if (left < 8) left = 8;
      if (top < 8) top = 8;

      this.elements.container.style.left = left + 'px';
      this.elements.container.style.top = top + 'px';
      this.elements.container.classList.add('open');
      this.elements.container.dataset.mode = this.state.mode;
      this.state.isOpen = true;
      this.drawHueCanvas();
      this.updateUI();
    }

    close() {
      this.elements.container.classList.remove('open');
      this.state.isOpen = false;
      if (this.options.onClose) this.options.onClose(this.getColor());
    }

    destroy() { this.elements.container.remove(); }
  }

  // 导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorPicker;
  } else {
    window.DreamanualColorPicker = ColorPicker;
  }

})();
