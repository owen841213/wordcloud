'use strict';

var WordCloudApp = function WordCloudApp() {
  // Special code here to handle non-supported browser case.
  if (!WordFreq.isSupported ||
      !WordCloud.isSupported ||
      !Object.keys ||
      !Array.prototype.map ||
      !Array.prototype.forEach ||
      !Array.prototype.indexOf ||
      !Function.prototype.bind ||
      !('onhashchange' in window)) {
    window.onload = function wca_browserDisabled() {
      var view = document.getElementById('wc-browser-support');
      delete view.hidden;
      view.removeAttribute('hidden');
    };
    this.isSupported = false;

    return;
  }
  this.isSupported = true;

  window.addEventListener('load', this);

  this.fetchers = {};
  this.views = {};
  this.currentUIState = this.UI_STATE_LOADING;

  // This array decides which view to show() when the UI state changes.
  this.UIStateViewMap = [
    ['loading'],
    ['canvas', 'source-dialog'],
    ['loading', 'dashboard'],
    ['canvas', 'dashboard'],
    ['canvas', 'dashboard', 'list-dialog'],
    ['loading', 'dashboard'],
    ['canvas', 'dashboard', 'sharer-dialog'],
    ['canvas', 'about-dialog']
  ];

  this.wordfreqOption = {
    workerUrl: './assets/wordfreq/src/wordfreq.worker.js'
  };

  this.shapes = [
    {
      shape: function shapeSquare(theta) {
        var thetaPrime = (theta + Math.PI / 4) % (2 * Math.PI / 4);
        return 1 / (Math.cos(thetaPrime) + Math.sin(thetaPrime));
      }
    },
    { shape: 'triangle-forward',
      ellipticity: 1 },
    { shape: 'circle' },
    { shape: 'star',
      ellipticity: 1 }
  ];

  this.themes = [
    {
      fontFamily: '"Trebuchet MS", "Heiti TC", "微軟正黑體", ' +
                  '"Arial Unicode MS", "Droid Fallback Sans", sans-serif',
      color: function getRandomDarkColor() {
        return 'rgb(' +
          Math.floor(Math.random() * 128 + 48).toString(10) + ',' +
          Math.floor(Math.random() * 128 + 48).toString(10) + ',' +
          Math.floor(Math.random() * 128 + 48).toString(10) + ')';
      },
      backgroundColor: '#eee'  //opaque white
    },
    {
      // http://ethantw.net/projects/lab/css-reset/
      fontFamily: 'Baskerville, "Times New Roman", "華康儷金黑 Std", ' +
                  '"華康儷宋 Std",  DFLiKingHeiStd-W8, DFLiSongStd-W5, ' +
                  '"Hiragino Mincho Pro", "LiSong Pro Light", "新細明體", serif',
      color: 'random-light',
      backgroundColor: '#000'
    },
    {
      // http://ethantw.net/projects/lab/css-reset/
      fontFamily: 'Baskerville, "Times New Roman", "華康儷金黑 Std", ' +
                  '"華康儷宋 Std",  DFLiKingHeiStd-W8, DFLiSongStd-W5, ' +
                  '"Hiragino Mincho Pro", "LiSong Pro Light", "新細明體", serif',
      color: '#fff',
      backgroundColor: '#000'
    },
    {
      // http://ethantw.net/projects/lab/css-reset/
      fontFamily: 'Baskerville, "Times New Roman", "華康儷金黑 Std", ' +
                  '"華康儷宋 Std",  DFLiKingHeiStd-W8, DFLiSongStd-W5, ' +
                  '"Hiragino Mincho Pro", "LiSong Pro Light", "新細明體", serif',
      color: '#d0d0d0',
      backgroundColor: '#999'
    },
    {
      fontFamily: '"Myriad Pro", "Lucida Grande", Helvetica, "Heiti TC", ' +
                  '"微軟正黑體", "Arial Unicode MS", "Droid Fallback Sans", ' +
                  'sans-serif',
      color: 'rgba(255,255,255,0.8)',
      backgroundColor: '#353130'
    },
    {
      fontFamily: '"Trebuchet MS", "Heiti TC", "微軟正黑體", ' +
                  '"Arial Unicode MS", "Droid Fallback Sans", sans-serif',
      color: 'rgba(0,0,0,0.7)',
      backgroundColor: 'rgba(255, 255, 255, 1)' //opaque white
    }
  ];

  this.data = {
    theme: 0,
    shape: 0,
    gridSize: undefined,
    weightFactor: undefined
  };
};
WordCloudApp.prototype.addView = function wca_addView(view) {
  this.views[view.name] = view;
  view.app = this;
};
WordCloudApp.prototype.addFetcher = function wca_addFetcher(fetcher) {
  fetcher.types.forEach((function(type) {
    this.fetchers[type] = fetcher;
  }).bind(this));
  fetcher.app = this;
};
WordCloudApp.prototype.pushUrlHash = function wca_pushUrlHash(hash) {
  // This two flags are introduced so that when [Back] button
  // of the dashboard is pressed, reset() can actually go back one step
  // in the browser history instead of always pushing a new url hash.
  // This is not bullet-proof, unfortunately.
  this.backToReset = (window.location.hash === '');
  this.lastUrlHashChangePushedByScript = true;

  window.location.hash = hash;
};
WordCloudApp.prototype.reset = function wca_reset() {
  if (!window.location.hash)
    return;

  if (this.backToReset) {
    // Go back
    window.history.back();
  } else {
    // Stack a new entry into history stack
    this.pushUrlHash('');
  }
};
WordCloudApp.prototype.UI_STATE_LOADING = 0;
WordCloudApp.prototype.UI_STATE_SOURCE_DIALOG = 1;
WordCloudApp.prototype.UI_STATE_WORKING = 2;
WordCloudApp.prototype.UI_STATE_DASHBOARD = 3;
WordCloudApp.prototype.UI_STATE_LIST_DIALOG = 4;
WordCloudApp.prototype.UI_STATE_ERROR_WITH_DASHBOARD = 5;
WordCloudApp.prototype.UI_STATE_SHARER_DIALOG = 6;
WordCloudApp.prototype.UI_STATE_ABOUT_DIALOG = 7;
WordCloudApp.prototype.switchUIState = function wca_switchUIState(state) {
  if (!this.UIStateViewMap[state])
    throw 'Undefined state ' + state;

  if (document.activeElement &&
      document.activeElement !== document.body) {
    document.activeElement.blur();
  }

  var UIs = Object.keys(this.views);
  var currentUIState = this.currentUIState;
  UIs.forEach((function showOrHide(viewName) {
    this.views[viewName][
      (this.UIStateViewMap[state].indexOf(viewName) !== -1) ?
      'show' : 'hide'](currentUIState, state);
  }).bind(this));

  this.currentUIState = state;
};
WordCloudApp.prototype.handleData = function wca_handleData(text) {
  if (!text.length) {
    this.switchUIState(this.UI_STATE_ERROR_WITH_DASHBOARD);
    this.views.loading.updateLabel(
      this.views.loading.LABEL_ERROR_DATA);
    return;
  }

  this.currentFetcher = undefined;
  this.views.loading.updateLabel(
    this.views.loading.LABEL_ANALYZING);

  var volume;
  this.wordfreq =
    WordFreq(this.wordfreqOption).process(text)
    .getVolume(function gotVolume(vol) {
      volume = vol;
    }).getList((function gotList(list) {
      this.wordfreq = undefined;
      this.handleList(list, volume);
    }).bind(this));
};
WordCloudApp.prototype.handleList = function wca_handleList(list, vol) {
  if (!list.length) {
    this.switchUIState(this.UI_STATE_ERROR_WITH_DASHBOARD);
    this.views.loading.updateLabel(
      this.views.loading.LABEL_ERROR_LIST);
    return;
  }

  this.switchUIState(this.UI_STATE_DASHBOARD);

  this.data.list = list;
  this.data.gridSize = 4;
  this.calculateWeightFactor(vol);

  this.draw();
};
WordCloudApp.prototype.draw = function wca_draw() {
  var canvasView = this.views.canvas;
  canvasView.setDimension();
  canvasView.draw(this.getWordCloudOption());
};
WordCloudApp.prototype.calculateWeightFactor =
  function wca_calculateWeightFactor(vol) {
    var width = document.documentElement.offsetWidth;
    var height = document.documentElement.offsetHeight;
    this.data.weightFactor = Math.sqrt(width * height / vol);
  };
WordCloudApp.prototype.getWordCloudOption = function wca_getWordCloudOption() {
  var option = { };

  var dataKeys = Object.keys(this.data);
  dataKeys.forEach((function copyThemeValues(key) {
    option[key] = this.data[key];
  }).bind(this));

  var themeKeys = Object.keys(this.themes[this.data.theme]);
  themeKeys.forEach((function copyThemeValues(key) {
    option[key] = this.themes[this.data.theme][key];
  }).bind(this));

  var shapeKeys = Object.keys(this.shapes[this.data.shape]);
  shapeKeys.forEach((function copyThemeValues(key) {
    option[key] = this.shapes[this.data.shape][key];
  }).bind(this));

  return option;
};
WordCloudApp.prototype.showSharer = function wca_showSharer(type) {
  this.views['sharer-dialog'].type = type;
  this.switchUIState(this.UI_STATE_SHARER_DIALOG);
};
WordCloudApp.prototype.route = function wca_route() {
  var hash = window.location.hash;

  if (this.backToReset && !this.lastUrlHashChangePushedByScript)
    this.backToReset = false;

  this.lastUrlHashChangePushedByScript = false;

  // Stop any current fetcher async operation
  if (this.currentFetcher) {
    this.currentFetcher.stop();
    this.currentFetcher = undefined;
  }

  // Stop any current WordFreq async operation
  if (this.wordfreq) {
    this.wordfreq.stop(false);
    this.wordfreq = undefined;
  }

  if (!hash) {
    this.switchUIState(this.UI_STATE_SOURCE_DIALOG);
    this.views.canvas.drawIdleCloud();
    return;
  }

  var dataType, data;
  hash.substr(1).match(/^([^:]+):?(.*)$/).forEach(function matchHash(str, i) {
    switch (i) {
      case 1:
        dataType = str;
        break;

      case 2:
        data = str;
        break;
    }
  });

  var fetcherType = (dataType.indexOf('.') === -1) ?
    dataType : dataType.split('.')[0];

  if (fetcherType in this.fetchers) {
    this.switchUIState(this.UI_STATE_WORKING);
    var fetcher = this.currentFetcher = this.fetchers[fetcherType];
    this.views.loading.updateLabel(fetcher.LABEL_VERB);
    fetcher.getData(dataType, data);
  } else {
    // Can't handle such data. Reset the URL hash.
    this.reset();
  }
};
WordCloudApp.prototype.handleEvent = function wca_handleEvent(evt) {
  switch (evt.type) {
    case 'load':
      // Remove the load listener
      window.removeEventListener('load', this);

      // Start listening to hashchange
      window.addEventListener('hashchange', this);
      // Process the current hash
      this.route();
      break;

    case 'hashchange':
      this.route();
      break;
  }
};

// Super light-weight prototype-based objects and inherences
var View = function View() { };
View.prototype.load = function v_load(properties, defaultProperties) {
  properties = properties || {};
  for (var name in defaultProperties) {
    if (name in this)
      break;

    this[name] = (name in properties) ?
      properties[name] : defaultProperties[name];

    if (name === 'element' || /Element$/.test(name)) {
      this[name] = (typeof this[name] === 'string') ?
        document.getElementById(this[name]) : this[name];
    }
  }
};
View.prototype.show = function v_show(currentState, nextState) {
  if (('beforeShow' in this) &&
      this.beforeShow.apply(this, arguments) === false) {
    return false;
  }

  this.element.hidden = false;

  if ('afterShow' in this) {
    this.afterShow.apply(this, arguments);
  }
  return true;
};
View.prototype.hide = function v_hide(currentState, nextState) {
  if (('beforeHide' in this) &&
      this.beforeHide.apply(this, arguments) === false) {
    return false;
  }

  this.element.hidden = true;

  if ('afterHide' in this) {
    this.afterHide.apply(this, arguments);
  }
  return true;
};

var LanguageSwitcherView = function LanguageSwitcher(opts) {
  this.load(opts, {
    element: 'wc-language'
  });

  // Collect the information about available languages from HTML.
  var langs = this.langs = [];
  Array.prototype.forEach.call(this.element.children, function lang(el) {
    langs.push(el.value);
    if (el.value === navigator.language)
      el.selected = true;
  });

  if (langs.indexOf(navigator.language) === -1) {
    // Default to the first one.
    this.element.selectedIndex = 0;
    document.webL10n.setLanguage(langs[0]);
  }

  // 'localized' is a CustomEvent dispatched by l10n.js
  document.addEventListener('localized', this);
  this.element.addEventListener('change', this);
};
LanguageSwitcherView.prototype = new View();
LanguageSwitcherView.prototype.handleEvent = function lsv_handleEvent(evt) {
  switch (evt.type) {
    case 'change':
      document.webL10n.setLanguage(this.element.value);
      break;

    case 'localized':
      document.documentElement.lang = evt.language;
      break;
  }
};

var CanvasView = function CanvasView(opts) {
  this.load(opts, {
    name: 'canvas',
    element: 'wc-canvas'
  });

  this.idleOption = {
    fontFamily: 'serif',
    color: 'rgba(255, 255, 255, 0.8)',
    rotateRatio: 0.5,
    backgroundColor: 'transparent',
    list: (function generateLoveList() {
      var list = [];
      var nums = [5, 4, 3, 2, 2];
      // This list of the word "Love" in language of the world was taken from
      // the Language links of entry "Cloud" in English Wikipedia,
      // with duplicate spelling removed.
      var words = ('Arai,Awan,Bodjal,Boira,Bulud,Bulut,Caad,Chmura,Clood,' +
        'Cloud,Cwmwl,Dampog,Debesis,Ewr,Felhő,Hodei,Hûn,Koumoul,Leru,Lipata,' +
        'Mixtli,Moln,Mây,Méga,Mākoņi,Neul,Niula,Nivulu,Nor,Nouage,Nuage,Nube,' +
        'Nubes,Nubia,Nubo,Nuvem,Nuvi,Nuvia,Nuvola,Nwaj,Nívol,Nóvvla,Nùvoła,' +
        'Nùvula,Núvol,Nûl,Nûlêye,Oblaci,Oblak,Phuyu,Pil\'v,Pilv,Pilvi,Qinaya,' +
        'Rahona,Rakun,Retë,Scamall,Sky,Ský,Swarken,Ulap,Vo\'e,Wingu,Wolcen,' +
        'Wolk,Wolke,Wollek,Wulke,dilnu,Νέφος,Абр,Болот,Болытлар,Булут,' +
        'Бұлттар,Воблакі,Облак,Облака,Хмара,Үүл,Ամպ,וואלקן,ענן,' +
        'ابر,بادل,بدل,سحاب,ورېځ,ھەور,ܥܢܢܐ,' +
        'ढग,बादल,सुपाँय्,মেঘ,ਬੱਦਲ,વાદળ,முகில்,' +
        'మేఘం,മേഘം,เมฆ,སྤྲིན།,ღრუბელი,ᎤᎶᎩᎸ,ᓄᕗᔭᖅ,云,雲,구름').split(',');

      nums.forEach(function(n) {
        words.forEach(function(w) {
          list.push([w, n]);
        });
      });

      return list;
    })()
  };
};
CanvasView.prototype = new View();
CanvasView.prototype.beforeShow =
CanvasView.prototype.beforeHide = function cv_beforeShowHide(state, nextState) {
  switch (nextState) {
    case this.app.UI_STATE_SOURCE_DIALOG:
      if (state == this.app.UI_STATE_ABOUT_DIALOG)
        break;
      this.drawIdleCloud();
      break;

    case this.app.UI_STATE_LOADING:
    case this.app.UI_STATE_WORKING:
      this.empty();
      break;
  }
};
CanvasView.prototype.setDimension = function cv_setDimension(width, height) {
  var el = this.element;
  width = width ? width : document.documentElement.offsetWidth;
  height = height ? height : document.documentElement.offsetHeight;
  el.setAttribute('width', width);
  el.setAttribute('height', height);
  el.style.marginLeft = (- width / 2) + 'px';
  el.style.marginTop = (- height / 2) + 'px';
};
CanvasView.prototype.draw = function cv_draw(option) {
  // Have generic font selected based on UI language
  this.element.lang = '';

  WordCloud(this.element, option);
};
CanvasView.prototype.drawIdleCloud = function cv_drawIdleCloud() {
  var el = this.element;
  var width = document.documentElement.offsetWidth;
  var height = document.documentElement.offsetHeight;

  this.setDimension(width, height);
  this.idleOption.gridSize = Math.round(16 * width / 1024);
  this.idleOption.weightFactor = function weightFactor(size) {
    return Math.pow(size, 2.3) * width / 1024;
  };

  // Make sure Latin characters looks correct for non-English the UI language
  el.lang = 'en';

  WordCloud(el, this.idleOption);
};
CanvasView.prototype.empty = function cv_empty() {
  WordCloud(this.element, {
    backgroundColor: 'transparent'
  });
};

var LoadingView = function LoadingView(opts) {
  this.load(opts, {
    name: 'loading',
    element: 'wc-loading',
    labelElement: 'wc-loading-label'
  });

  this.stringIds = [
    'downloading',
    'loading',
    'analyzing',
    'no_data',
    'no_list_output'
  ];
};
LoadingView.prototype = new View();
LoadingView.prototype.LABEL_DOWNLOADING = 0;
LoadingView.prototype.LABEL_LOADING = 1;
LoadingView.prototype.LABEL_ANALYZING = 2;
LoadingView.prototype.LABEL_ERROR_DATA = 3;
LoadingView.prototype.LABEL_ERROR_LIST = 4;
LoadingView.prototype.beforeShow = function l_beforeShow(state, nextState) {
  if (nextState === this.app.UI_STATE_ERROR_WITH_DASHBOARD) {
    this.element.classList.add('error');
  } else {
    this.element.classList.remove('error');
  }
};
LoadingView.prototype.updateLabel = function l_updateLabel(stringId) {
  if (!this.stringIds[stringId])
    throw 'Undefined stringId ' + stringId;

  // XXX: replace this with l10n library calls
  this.labelElement.textContent = this.stringIds[stringId];
};

var SourceDialogView = function SourceDialogView(opts) {
  this.load(opts, {
    name: 'source-dialog',
    element: 'wc-source-dialog',
    menuElement: 'wc-source-menu',
    startBtnElement: 'wc-source-start-btn',
    panelContainerElement: 'wc-source-panels',
    aboutBtnElement: 'wc-source-about-btn'
  });

  this.currentPanel = null;
  this.panels = {};

  this.menuElement.addEventListener('click', this);
  this.startBtnElement.addEventListener('click', this);
  this.panelContainerElement.addEventListener('submit', this);
  this.aboutBtnElement.addEventListener('click', this);
};
SourceDialogView.prototype = new View();
SourceDialogView.prototype.afterShow = function sdv_afterShow() {
  if (this.currentPanel)
    this.currentPanel.show();
};
SourceDialogView.prototype.handleEvent = function sd_handleEvent(evt) {
  evt.preventDefault();
  if (evt.type == 'submit') {
    this.currentPanel.submit();
    return;
  }

  switch (evt.currentTarget) {
    case this.menuElement:
      var panelName = evt.target.dataset.panel;
      if (!panelName || !this.panels[panelName])
        return;

      this.showPanel(this.panels[panelName]);
      break;

    case this.aboutBtnElement:
      this.app.switchUIState(this.app.UI_STATE_ABOUT_DIALOG);
      break;

    case this.startBtnElement:
      this.currentPanel.submit();
      break;
  }
};
SourceDialogView.prototype.submit = function sd_submit(hash) {
  this.app.pushUrlHash(hash);
};
SourceDialogView.prototype.showPanel = function sd_showPanel(panel) {
  if (this.currentPanel)
    this.currentPanel.hide();

  panel.show();
  this.currentPanel = panel;
};
SourceDialogView.prototype.addPanel = function sd_addPanel(panel) {
  this.panels[panel.name] = panel;
  panel.menuItemElement =
    this.menuElement.querySelector('[data-panel="' + panel.name + '"]');

  if (!panel.menuItemElement)
    throw 'menuItemElement not found.';

  panel.menuItemElement.parentNode.hidden = false;
  panel.dialog = this;

  if ('isSupported' in panel && !panel.isSupported) {
    panel.menuItemElement.parentNode.classList.add('disabled');
    panel.menuItemElement.dataset.panel = undefined;
    return;
  }

  if (!this.currentPanel)
    this.showPanel(panel);
};

var DashboardView = function DashboardView(opts) {
  this.load(opts, {
    name: 'dashboard',
    element: 'wc-dashboard'
  });

  var buttons = this.element.querySelectorAll('[data-action]');
  var i = buttons.length;
  while (i--) {
    buttons[i].addEventListener('click', this);
  }
};
DashboardView.prototype = new View();
DashboardView.prototype.beforeShow =
DashboardView.prototype.beforeHide =
  function dv_beforeShowHide(state, nextState) {
    var ctlBtns = this.element.querySelectorAll('[data-canvas-ctl]');

    if (nextState === this.app.UI_STATE_DASHBOARD) {
      var i = ctlBtns.length;
      while (i--) {
        var el = ctlBtns[i];
        el.classList.remove('disabled');
      }
    } else {
      var i = ctlBtns.length;
      while (i--) {
        var el = ctlBtns[i];
        el.classList.add('disabled');
      }
    }
  };
DashboardView.prototype.handleEvent = function dv_handleEvent(evt) {
  var el = evt.currentTarget;
  if (el.classList.contains('disabled'))
    return;

  var app = this.app;
  var action = el.dataset.action;

  switch (action) {
    case 'back':
      app.reset();
      break;

    case 'refresh':
      app.draw();
      break;

    case 'theme':
      app.data.theme++;
      if (app.data.theme >= app.themes.length)
        app.data.theme = 0;

      app.draw();
      break;

    case 'shape':
      app.data.shape++;
      if (app.data.shape >= app.shapes.length)
        app.data.shape = 0;

      app.draw();
      break;

    case 'edit':
      app.switchUIState(app.UI_STATE_LIST_DIALOG);
      break;

    case 'size+':
      app.data.weightFactor += 0.1;

      app.draw();
      break;

    case 'size-':
      if (app.data.weightFactor <= 0.1)
        break;

      app.data.weightFactor -= 0.1;

      app.draw();
      break;

    case 'gap+':
      app.data.gridSize++;

      app.draw();
      break;

    case 'gap-':
      if (app.data.gridSize <= 2)
        break;

      app.data.gridSize--;

      app.draw();
      break;

    case 'save':
      // We could use canvasElement.toBlob(callback) here,
      // but we will miss the default action (download).
      var url = app.views.canvas.element.toDataURL();
      if ('download' in document.createElement('a')) {
        el.href = url;

        // Let's not keep this in the DOM forever.
        setTimeout(function cleanUrl() {
          el.href = '#';
        }, 0);
      } else {
        evt.preventDefault();
        // XXX: l10n
        alert('Please right click and choose "Save As..."' +
              ' to save the generated image.');
        window.open(url, '_blank', 'width=500,height=300,menubar=yes');
      }

      break;

    case 'facebook':
    case 'plurk':
    case 'twitter':
    case 'tumblr':
      app.showSharer(action);

      break;
  }
};

var ListDialogView = function ListDialogView(opts) {
  this.load(opts, {
    name: 'list-dialog',
    element: 'wc-list-dialog',
    textElement: 'wc-list-edit',
    cancelBtnElement: 'wc-list-cancel-btn',
    confirmBtnElement: 'wc-list-confirm-btn'
  });

  this.cancelBtnElement.addEventListener('click', this);
  this.confirmBtnElement.addEventListener('click', this);
};
ListDialogView.prototype = new View();
ListDialogView.prototype.beforeShow = function ldv_beforeShow() {
  this.textElement.value = this.app.data.list.map(function mapItem(item) {
    return item[1] + '\t' + item[0];
  }).join('\n');
};
ListDialogView.prototype.afterShow = function ldv_afterShow() {
  this.textElement.focus();
};
ListDialogView.prototype.afterHide = function ldv_afterHide() {
  this.textElement.value = '';
};
ListDialogView.prototype.handleEvent = function ldv_handleEvent(evt) {
  switch (evt.target) {
    case this.confirmBtnElement:
      this.submit();

      break;

    case this.cancelBtnElement:
      this.close();

      break;
  }
};
ListDialogView.prototype.submit = function ldv_submit() {
  var el = this.textElement;
  var hash;
  if (window.btoa) {
    // Protect the encoded string with base64 to workaround Safari bug,
    // which improve sharability of the URL.
    hash = '#base64-list:' +
      window.btoa(unescape(encodeURIComponent(el.value)));
  } else {
    hash = '#list:' + encodeURIComponent(el.value);
  }

  if (hash !== window.location.hash) {
    this.app.pushUrlHash(hash);
  } else {
    // It's useless to push the same hash here;
    // Let's close ourselves.
    this.app.switchUIState(this.app.UI_STATE_DASHBOARD);
  }
};
ListDialogView.prototype.close = function ldv_close() {
  this.app.switchUIState(this.app.UI_STATE_DASHBOARD);
};

var SharerDialogView = function SharerDialogView(opts) {
  this.load(opts, {
    name: 'sharer-dialog',
    element: 'wc-sharer-dialog',
    titleElement: 'wc-sharer-title',
    imgElement: 'wc-sharer-img',
    imgLinkElement: 'wc-sharer-img-link',
    progressElement: 'wc-sharer-progress',
    statusElement: 'wc-sharer-status',
    facebookLoginElement: 'wc-sharer-facebook-login-btn',
    reUploadBtnElement: 'wc-sharer-reupload-btn',
    shareBtnElement: 'wc-sharer-share-btn',
    cancelBtnElement: 'wc-sharer-cancel-btn'
  });

  this.imgLinkElement.addEventListener('click', this);
  this.shareBtnElement.addEventListener('click', this);
  this.facebookLoginElement.addEventListener('click', this);
  this.reUploadBtnElement.addEventListener('click', this);
  this.cancelBtnElement.addEventListener('click', this);

  this.imgElement.addEventListener('load', function sdv_imgLoaded(evt) {
    window.URL.revokeObjectURL(this.src);
  });

  if (!window.HTMLCanvasElement.prototype.toBlob) {
    // Load canvas-to-blob library to see if we could shim it.
    var el = document.createElement('script');
    el.src = './assets/canvas-to-blob/canvas-to-blob.min.js';
    document.documentElement.firstElementChild.appendChild(el);
  }

  this.stringIds = [
    'share-to-facebook',
    'share-to-plurk',
    'share-to-twitter',
    'uploading-to-imgur',
    'image-uploaded',
    'error-fallback-to-text',
    'facebook-getting-photo',
    'need-facebook-login',
    'share-to-tumblr'
  ];
};
SharerDialogView.prototype = new View();
SharerDialogView.prototype.HASHTAG = '#HTML5WordCloud';
SharerDialogView.prototype.TWITTER_SHARE_URL =
  'https://twitter.com/home/?status=';
SharerDialogView.prototype.PLURK_SHARE_URL =
  'http://plurk.com/?status=';
SharerDialogView.prototype.FACEBOOK_PHOTO_URL =
  'https://www.facebook.com/photo.php?fbid=';
SharerDialogView.prototype.IMGUR_URL =
  'http://imgur.com/';
SharerDialogView.prototype.IMGUR_API_URL =
  'https://api.imgur.com/3/upload.json';
SharerDialogView.prototype.SHARED_ITEM_LIMIT = 10;
SharerDialogView.prototype.LABEL_TITLE_FACEBOOK = 0;
SharerDialogView.prototype.LABEL_TITLE_PLURK = 1;
SharerDialogView.prototype.LABEL_TITLE_TWITTER = 2;
SharerDialogView.prototype.LABEL_STATUS_IMGUR_UPLOADING = 3;
SharerDialogView.prototype.LABEL_STATUS_IMAGE_UPLOADED = 4;
SharerDialogView.prototype.LABEL_STATUS_FALLBACK_TEXT = 5;
SharerDialogView.prototype.LABEL_FACEBOOK_WINDOW_LOADING = 6;
SharerDialogView.prototype.LABEL_ALERT_NEED_FACEBOOK_LOGIN = 7;
SharerDialogView.prototype.LABEL_TITLE_TUMBLR = 8;
SharerDialogView.prototype.beforeShow = function sdv_beforeShow() {
  if (!this.type)
    throw 'shareDialogView.type must be set before show().';

  var uploadSupported = !!(window.HTMLCanvasElement.prototype.toBlob &&
    window.XMLHttpRequest && window.FormData);

  if (uploadSupported) {
    this.shareImage();
  } else {
    this.shareText();
    var app = this.app;
    setTimeout(function updateState() {
      app.switchUIState(app.UI_STATE_DASHBOARD);
    });
    return false; // prevent us from showing up
  }
};
SharerDialogView.prototype.afterHide = function sdv_afterHide() {
  this.type = undefined;
  if (this.xhr) {
    this.xhr.abort();
    this.xhr = null;
  }
};
SharerDialogView.prototype.handleEvent = function sdv_handleEvent(evt) {
  if (evt.target.disabled)
    return;

  switch (evt.target) {
    case this.shareBtnElement:
      this.sendImage();

      break;

    case this.reUploadBtnElement:
      this.uploadImage();

      break;

    case this.facebookLoginElement:
      FB.login(function noop() {}, { scope: 'publish_stream' });

      break;

    case this.imgLinkElement:
      if (!this.imgurData) {
        evt.preventDefault();

        break;
      }

      break;

    case this.cancelBtnElement:
      this.close();
      break;
  }
};
SharerDialogView.prototype.close = function sdv_close() {
  this.app.switchUIState(this.app.UI_STATE_DASHBOARD);
};
SharerDialogView.prototype.getCanvasBlob = function sdv_getCanvasBlob(cb) {
  this.app.views['canvas'].element.toBlob(cb.bind(this));
};
SharerDialogView.prototype.updateTitle = function sdv_updateTitle(stringId) {
  if (!this.stringIds[stringId])
    throw 'Undefined stringId ' + stringId;

  // XXX: replace this with l10n library calls
  this.titleElement.textContent = this.stringIds[stringId];
};
SharerDialogView.prototype.updateStatus = function sdv_updateStatus(stringId) {
  if (!this.stringIds[stringId])
    throw 'Undefined stringId ' + stringId;

  // XXX: replace this with l10n library calls
  this.statusElement.textContent = this.stringIds[stringId];
};
SharerDialogView.prototype.updateProgress =
  function sdv_updateProgress(progress, active) {
    this.progressElement.style.width = Math.floor(progress * 100) + '%';
    // Don't use classList here for IE9
    this.progressElement.parentNode.className =
      'progress progress-striped' + (active ? ' active' : '');
  };
SharerDialogView.prototype.updateFacebookUI = function sdv_updateFacebookUI() {
  this.facebookLoginElement.hidden =
    (this.type !== 'facebook' || this.hasFacebookPermission);
};
SharerDialogView.prototype.getCloudTitle = function sdv_getCloudTitle() {
  // XXX l10n
  return 'HTML5 Word Cloud';
};
SharerDialogView.prototype.getCloudList = function sdv_getCloudList() {
  var list = this.app.data.list;
  var i = 0;
  var sharedItems = [];
  do {
    sharedItems[i] = list[i][0];
  } while (++i < this.SHARED_ITEM_LIMIT);

  // XXX l10n
  return 'most frequent terms: ' + sharedItems.join(', ') +
        ((list.length > this.SHARED_ITEM_LIMIT) ? '...' : '');
};
SharerDialogView.prototype.shareText = function sdv_shareText() {
  var url = window.location.href;
  switch (this.type) {
    case 'facebook':
      // Load Facebook SDK at this point;
      // We won't wrap other FB.xxx calls in other functions
      // because this is the only entry point for FacebookPanelView.
      (new FacebookSDKLoader()).load((function sdv_bindFacebookSDK() {
        // XXX This will be blocked by pop-up blocker.
        FB.ui({
          method: 'feed',
          link: url,
          name: this.getCloudTitle(),
          description: this.getCloudList(),
          display: 'iframe'
        });
      }).bind(this));
      break;

    case 'plurk':
      window.open(this.PLURK_SHARE_URL +
        encodeURIComponent(
          url + ' (' +
          this.getCloudTitle() + ') ' +
          this.getCloudList() + ' ' +
          this.HASHTAG));
      break;

    case 'twitter':
      window.open(this.TWITTER_SHARE_URL +
        encodeURIComponent(
          url + ' ' +
          this.getCloudTitle() + ' ' +
          this.getCloudList() + ' ' +
          this.HASHTAG));
      break;

    case 'tumblr':
      window.open('http://www.tumblr.com/share/link?=description=' +
         encodeURIComponent(this.getCloudList()) +
         '&name=' + encodeURIComponent(this.getCloudTitle()) +
         '&url=' + encodeURIComponent(url));
      this.close();

    default:
      throw 'Unknown shareDialogView type ' + this.type;
  }
};
SharerDialogView.prototype.shareImage = function sdv_shareImage() {
  switch (this.type) {
    case 'facebook':
      (new FacebookSDKLoader()).load((function sdv_bindFacebookSDK() {
        if (this.facebookLoaded)
          return;

        this.facebookLoaded = true;

        FB.getLoginStatus(this.updateFacebookStatus.bind(this));
        FB.Event.subscribe(
          'auth.authResponseChange', this.updateFacebookStatus.bind(this));
      }).bind(this));

      // no 'break' here.

    case 'plurk':
    case 'twitter':
    case 'tumblr':
      this.updateTitle(this['LABEL_TITLE_' + this.type.toUpperCase()]);

      break;

    default:
      throw 'Unknown shareDialogView type ' + this.type;
  }

  // Start upload if we have never upload any image.
  if (!this.imgurData) {
    this.reUploadBtnElement.disabled = true;
    this.uploadImage();
  } else {
    this.reUploadBtnElement.disabled = false;
  }
  this.updateFacebookUI();
};
SharerDialogView.prototype.updateFacebookStatus =
  function sdv_updateFacebookStatus(res) {
    if (res.status === 'connected') {
      FB.api('/me/permissions', (function checkPermissions(res) {
        this.hasFacebookPermission = (res.data[0]['publish_stream'] == 1);
        this.updateFacebookUI();
      }).bind(this));
    } else {
      this.hasFacebookPermission = false;
    }
    this.updateFacebookUI();
  };
SharerDialogView.prototype.uploadImage = function sdv_uploadImage() {
  if (!window.IMGUR_CLIENT_ID)
    throw 'IMGUR_CLIENT_ID is not set.';

  this.imgurData = undefined;
  this.updateStatus(this.LABEL_STATUS_IMGUR_UPLOADING);
  this.updateProgress(0.05, true);
  this.shareBtnElement.disabled = true;

  var formdata = new FormData();
  formdata.append('title', this.getCloudTitle());
  formdata.append('name', 'wordcloud.png');
  formdata.append('description',
    this.getCloudList() + '\n\n' + window.location.href);

  var xhr = new XMLHttpRequest();
  xhr.open('POST', this.IMGUR_API_URL);
  xhr.setRequestHeader('Authorization', 'Client-ID ' + IMGUR_CLIENT_ID);

  if (xhr.upload) {
    xhr.upload.onprogress = (function sdv_xhrProgress(evt) {
      this.updateProgress(evt.loaded / evt.total, true);
    }).bind(this);
  } else {
    this.updateProgress(1, true);
  }

  xhr.onreadystatechange = (function sdv_xhrFinish(evt) {
    if (xhr.readyState !== XMLHttpRequest.DONE || !this.type)
      return;

    this.xhr = null;
    var response;
    try {
      response = JSON.parse(xhr.responseText);
    } catch (e) {}

    if (!response || !response.success) {
      // Upload failed
      this.updateProgress(0.05, false);
      this.updateStatus(this.LABEL_STATUS_FALLBACK_TEXT);
      this.shareBtnElement.disabled = false;
      this.reUploadBtnElement.disabled = false;

      return;
    }

    // Upload succeed
    this.imgurData = response.data;
    this.imgLinkElement.href = this.IMGUR_URL + this.imgurData.id;

    this.updateProgress(1, false);
    this.updateStatus(this.LABEL_STATUS_IMAGE_UPLOADED);
    this.shareBtnElement.disabled = false;
  }).bind(this);

  this.getCanvasBlob(function sdv_gotBlob(blob) {
    if (!this.type)
      return;

    this.imgElement.src = window.URL.createObjectURL(blob);

    formdata.append('image', blob);
    xhr.send(formdata);
    this.xhr = xhr;
  });
};
SharerDialogView.prototype.sendImage = function sdv_sendImage() {
  if (!this.imgurData) {
    this.shareText();

    return;
  }

  var url = window.location.href;
  switch (this.type) {
    case 'facebook':
      if (!this.hasFacebookPermission) {
        // XXX l10n
        alert(this.stringIds[this.LABEL_ALERT_NEED_FACEBOOK_LOGIN]);

        return;
      }

      // Get us a new window here to workaround pop-up blocker
      // once the image is uploaded.
      // Obviously this is not the optimal user experience.

      // XXX l10n
      var facebookWin = window.open('data:text/html,' +
        encodeURIComponent(this.stringIds[this.LABEL_FACEBOOK_WINDOW_LOADING]));

      // XXX This is sad. We couldn't make a CORS XHR request
      // to Facebook Graph API to send our image directly,
      // so we ask Facebook to pull the image uploaded to Imgur.
      FB.api('/me/photos', 'post', {
        url: this.imgurData.link,
        message: this.getCloudTitle() + '\n\n' +
          this.getCloudList() + '\n\n' + url
      }, (function sdv_facebookImageUploaded(res) {
        if (!res || !res.id) {
          facebookWin.close();

          if (!this.type)
            return;

          // Failed, fall back to sharing via FB.ui() instead.
          this.shareText();
          this.close();

          return;
        }

        facebookWin.location.href = this.FACEBOOK_PHOTO_URL + res.id;

        if (!this.type)
          return;

        this.close();
      }).bind(this));

      break;

    case 'plurk':
      window.open(this.PLURK_SHARE_URL +
        encodeURIComponent(
          this.imgurData.link + ' ' +
          url + ' (' + this.getCloudTitle() + ') ' +
          this.getCloudList() + ' ' +
          this.HASHTAG));
      this.close();

      break;

    case 'twitter':
      window.open(this.TWITTER_SHARE_URL +
        encodeURIComponent(
          url + ' ' +
          this.getCloudTitle() + ' ' +
          this.getCloudList() + ' ' +
          this.imgurData.link + ' ' +
          this.HASHTAG));
      this.close();

      break;

    case 'tumblr':
      window.open('http://www.tumblr.com/share/photo?source=' +
         encodeURIComponent(this.imgurData.link) +
         '&caption=' + encodeURIComponent(
            this.getCloudTitle() + '\n' + this.getCloudList()) +
         '&clickthru=' + encodeURIComponent(url));
      this.close();

      break;

    default:
      throw 'Unknown shareDialogView type ' + this.type;
  }
};

var PanelView = function PanelView() {
};
PanelView.prototype = new View();
PanelView.prototype.beforeShow = function pv_beforeShow() {
  this.menuItemElement.parentNode.className = 'active';
};
PanelView.prototype.afterShow = function pv_afterShow() {
  var el = this.element.querySelector('input, button, select, textarea');
  if (el)
    el.focus();
};
PanelView.prototype.beforeHide = function pv_beforeHide() {
  this.menuItemElement.parentNode.className = '';
};

var ExamplePanelView = function ExamplePanelView(opts) {
  this.load(opts, {
    name: 'example',
    element: 'wc-panel-example'
  });
};
ExamplePanelView.prototype = new PanelView();
ExamplePanelView.prototype.submit = function epv_submit() {
  var els = this.element.example;
  for (var el in els) {
    if (els[el].checked) {
      this.dialog.submit('#' + els[el].value);
      break;
    }
  }
};

var CPPanelView = function CPPanelView(opts) {
  this.load(opts, {
    name: 'cp',
    element: 'wc-panel-cp',
    textareaElement: 'wc-panel-cp-textarea'
  });
};
CPPanelView.prototype = new PanelView();
CPPanelView.prototype.submit = function cpv_submit() {
  var el = this.textareaElement;

  if (!el.value.length) {
    // maybe a warning here?
    return;
  }

  if (window.btoa) {
    // Protect the encoded string with base64 to workaround Safari bug,
    // which improve sharability of the URL.
    this.dialog.submit(
      '#base64:' + window.btoa(unescape(encodeURIComponent(el.value))));
  } else {
    this.dialog.submit('#text:' + encodeURIComponent(el.value));
  }
};

var FilePanelView = function FilePanelView(opts) {
  this.load(opts, {
    name: 'file',
    element: 'wc-panel-file',
    fileElement: 'wc-panel-file-file',
    fileLabelElement: 'wc-panel-file-file-label',
    encodingElement: 'wc-panel-file-encoding'
  });
  var count = this.fileElement.files.length;
  this.updateLabel(count);
  this.fileElement.addEventListener('change', this);
};
FilePanelView.prototype = new PanelView();
FilePanelView.prototype.handleEvent = function fpv_handleEvent(evt) {
  var count = this.fileElement.files.length;
  this.updateLabel(count);
};
FilePanelView.prototype.updateLabel = function fpv_updateLabel(count) {
  // XXX: l10n
  this.fileLabelElement.textContent =
    count ? (count + 'file-selected') : 'no-file-selected';
};
FilePanelView.prototype.isSupported = !!window.FileReader;
FilePanelView.prototype.submit = function fpv_submit() {
  var el = this.fileElement;

  if (!el.files.length) {
    // maybe a warning here?
    return;
  }

  var file = el.files[0];
  if (file.type !== 'text/plain') {
    // XXX: l10n
    alert('Please select a plain text file.');
    return;
  }

  this.dialog.submit('#file');
};

var FeedPanelView = function FeedPanelView(opts) {
  this.load(opts, {
    name: 'feed',
    element: 'wc-panel-feed',
    inputElement: 'wc-panel-feed-url',
    template: '%s'
  });
};
FeedPanelView.prototype = new PanelView();
FeedPanelView.prototype.submit = function fepv_submit() {
  var el = this.inputElement;

  if (!el.value)
    return;

  this.dialog.submit(
    '#feed:' + this.template.replace(/%s/g, el.value));
};

var WikipediaPanelView = function WikipediaPanelView(opts) {
  this.load(opts, {
    name: 'wikipedia',
    element: 'wc-panel-wikipedia',
    inputElement: 'wc-panel-wikipedia-title'
  });
};
WikipediaPanelView.prototype = new PanelView();
WikipediaPanelView.prototype.submit = function wpv_submit() {
  var el = this.inputElement;

  if (!el.value)
    return;

  // XXX maybe provide a <select> of largest Wikipedias here.
  // (automatically from this table or manually)
  // https://meta.wikimedia.org/wiki/List_of_Wikipedias/Table
  // XXX l10n
  var lang = 'en';

  this.dialog.submit('#wikipedia.' + lang + ':' + el.value);
};

var FacebookPanelView = function FacebookPanelView(opts) {
  this.load(opts, {
    name: 'facebook',
    element: 'wc-panel-facebook',
    statusElement: 'wc-panel-facebook-status'
  });
  this.loaded = false;
};
FacebookPanelView.prototype = new PanelView();
FacebookPanelView.prototype.LABEL_LOGGED_IN = 'facebook-ready';
FacebookPanelView.prototype.LABEL_NOT_LOGGED_IN = 'facebook-start-to-login';

FacebookPanelView.prototype.beforeShow = function fbpv_beforeShow() {
  PanelView.prototype.beforeShow.apply(this, arguments);

  if (this.loaded)
    return;

  this.loaded = true;
  this.hasPermission = false;

  // Load Facebook SDK at this point;
  // We won't wrap other FB.xxx calls in other functions
  // because this is the only entry point for FacebookPanelView.
  (new FacebookSDKLoader()).load((function fbpv_bindFacebookSDK() {
    FB.getLoginStatus(this.updateStatus.bind(this));
    FB.Event.subscribe(
      'auth.authResponseChange', this.updateStatus.bind(this));
  }).bind(this));
};
FacebookPanelView.prototype.isReadyForFetch = function fbpv_isReadyForFetch() {
  return (this.facebookResponse &&
    this.facebookResponse.status === 'connected' &&
    this.hasPermission);
};
FacebookPanelView.prototype.updateStatus = function fbpv_updateStatus(res) {
  this.facebookResponse = res;
  if (this.facebookResponse.status === 'connected') {
    FB.api('/me/permissions', (function checkPermissions(res) {
      this.hasPermission = (res.data[0]['read_stream'] == 1);
      this.updateUI();
    }).bind(this));
  } else {
    this.hasPermission = false;
    this.updateUI();
  }
};
FacebookPanelView.prototype.updateUI = function fbpv_updateUI() {
  // XXX: l10n
  if (this.isReadyForFetch()) {
    this.statusElement.textContent = this.LABEL_LOGGED_IN;
  } else {
    this.statusElement.textContent = this.LABEL_NOT_LOGGED_IN;
  }
};
FacebookPanelView.prototype.submit = function fbpv_submit() {
  // Return if the status is never updated.
  if (!this.facebookResponse)
    return;

  // Show the login dialog if not logged in
  if (!this.isReadyForFetch()) {
    FB.login((function fbpv_loggedIn(res) {
      // XXX: There is no way to cancel the login pop-up midway if
      // the user navigates away from the panel (or the source dialog).
      // We shall do some checking here to avoid accidently switches the UI.
      if (this.element.hidden || this.dialog.element.hidden)
        return;

      this.facebookResponse = res;

      if (res.status !== 'connected')
        return;

      // Note that we assume we have the permission already
      // if the user logged in through here.
      // We have to overwrite this here so FacebookFetcher
      // could confirm the permission.
      this.hasPermission = true;

      this.dialog.submit(
        '#facebook:' + this.facebookResponse.authResponse.userID);
    }).bind(this), { scope: 'read_stream' });

    return;
  }

  this.dialog.submit(
    '#facebook:' + this.facebookResponse.authResponse.userID);
};

var GooglePlusPanelView = function GooglePlusPanelView(opts) {
  this.load(opts, {
    name: 'googleplus',
    element: 'wc-panel-googleplus',
    statusElement: 'wc-panel-googleplus-status',
    idElement: 'wc-panel-googleplus-id'
  });
  this.loaded = false;
};
GooglePlusPanelView.prototype = new PanelView();
GooglePlusPanelView.prototype.LABEL_LOGGED_IN = 'google-ready';
GooglePlusPanelView.prototype.LABEL_NOT_LOGGED_IN = 'google-start-to-login';
GooglePlusPanelView.prototype.beforeShow = function gppv_beforeShow() {
  if (!GOOGLE_CLIENT_ID)
    throw 'No GOOGLE_CLIENT_ID defined.';

  if (this.loaded)
    return;

  this.loaded = true;

  var el = document.createElement('script');
  el.src = './assets/go2/src/google-oauth2.js';
  el.onload = el.onerror = (function go2load() {
    el.onload = el.onerror = null;

    if (!window.GO2) {
      this.loaded = false;
      return;
    }

    var redirectUri = window.GO2_REDIRECT_URI ||
      document.location.href.replace(/\/(index.html)?(#.*)?$/i,
                                     '/go2-redirect.html');

    GO2.init({
      client_id: GOOGLE_CLIENT_ID,
      scope: this.GOOGLE_API_SCOPE || '',
      redirect_uri: redirectUri
    });

    GO2.login(false, true);

    // Update UI for the first time, as we might not
    // be able to log-in quietly.
    this.updateUI();

    GO2.onlogin = (function go2_onlogin(token) {
      this.accessToken = token;
      this.updateUI();

      if (this.submitted) {
        this.submitted = false;

        // XXX: There is no way to cancel the login pop-up midway if
        // the user navigates away from the panel (or the source dialog).
        // We shall do some checking here to avoid accidently switches the UI.
        if (this.element.hidden || this.dialog.element.hidden)
          return;

        this.realSubmit();
      }
    }).bind(this);

    GO2.onlogout = (function go2_onlogout() {
      this.accessToken = '';
      this.updateUI();
    }).bind(this);
  }).bind(this);

  document.documentElement.firstElementChild.appendChild(el);
};
GooglePlusPanelView.prototype.isReadyForFetch =
  function gppv_isReadyForFetch() {
    return !!this.accessToken;
  };
GooglePlusPanelView.prototype.updateUI = function gppv_updateUI() {
  // XXX: l10n
  if (this.isReadyForFetch()) {
    this.statusElement.textContent = this.LABEL_LOGGED_IN;
  } else {
    this.statusElement.textContent = this.LABEL_NOT_LOGGED_IN;
  }
};
GooglePlusPanelView.prototype.submit = function gppv_submit() {
  if (!window.GO2 || !this.loaded)
    return;

  if (!this.isReadyForFetch()) {
    this.submitted = true;
    GO2.login(true, false);

    return;
  }

  this.realSubmit();
};
GooglePlusPanelView.prototype.realSubmit = function gppv_realSubmit() {
  var id = this.idElement.value;
  if (!id)
    id = 'me';

  // Remove everything after the first slash.
  id = id.replace(/\/.*$/, '');

  this.dialog.submit('#googleplus:' + id);
};

var AboutDialogView = function AboutDialogView(opts) {
  this.load(opts, {
    name: 'about-dialog',
    element: 'wc-about-dialog',
    contentElement: 'wc-about-content',
    closeBtnElement: 'wc-about-close-btn'
  });

  this.loaded = false;

  this.closeBtnElement.addEventListener('click', this);
  this.contentElement.addEventListener('click', this);
  document.addEventListener('localized', this);
};
AboutDialogView.prototype = new View();
AboutDialogView.prototype.beforeShow = function adv_beforeShow() {
  this.loaded = true;
  var lang = document.webL10n.getLanguage();
  this.loadContent(lang, true);
};
AboutDialogView.prototype.loadContent = function adv_loadContent(lang, first) {
  // Everything would be a *lot* easier
  // if we could have seamless iframe here...
  var iframe = document.createElement('iframe');
  iframe.src = 'about.' + lang + '.html';
  this.contentElement.appendChild(iframe);

  iframe.onload = (function contentLoaded() {
    // Import nodes to this document
    var content = document.importNode(
      iframe.contentWindow.document.body, true);

    // Create a document fragment; move all the children to it.
    var docFrag = document.createDocumentFragment();
    while (content.firstElementChild) {
      docFrag.appendChild(content.firstElementChild);
    }

    // Append the children to the container.
    var container = this.contentElement;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(docFrag);
  }).bind(this);
  if (first) {
    iframe.onerror = (function contentLoadError() {
      this.loaded = false;
    }).bind(this);
  }
};
AboutDialogView.prototype.handleEvent = function adv_handleEvent(evt) {
  if (evt.type === 'localized') {
    this.loaded = false;

    return;
  }

  switch (evt.currentTarget) {
    case this.contentElement:
      if (evt.target.tagName === 'A') {
        evt.preventDefault();
        window.open(evt.target.href);
      }

      break;

    case this.closeBtnElement:
      this.close();

      break;
  }
};
AboutDialogView.prototype.close = function adv_close() {
  this.app.switchUIState(this.app.UI_STATE_SOURCE_DIALOG);
};

var Fetcher = function Fetcher() { };
Fetcher.prototype.LABEL_VERB = LoadingView.prototype.LABEL_LOADING;

var TextFetcher = function TextFetcher() {
  this.types = ['text', 'base64'];
};
TextFetcher.prototype = new Fetcher();
TextFetcher.prototype.stop = function tf_stop() {
  clearTimeout(this.timer);
};
TextFetcher.prototype.getData = function tf_getData(dataType, data) {
  if (dataType === 'base64')
    data = decodeURIComponent(escape(window.atob(data)));

  // Make sure we call the handler methods as async callback.
  this.timer = setTimeout((function tf_gotData() {
    this.app.handleData(data);
  }).bind(this), 0);
};

var FileFetcher = function FileFetcher() {
  this.types = ['file'];
};
FileFetcher.prototype = new Fetcher();
FileFetcher.prototype.stop = function ff_stop() {
  if (!this.reader || this.reader.readyState !== this.reader.LOADING)
    return;

  this.reader.abort();
  this.reader = null;
};
FileFetcher.prototype.getData = function ff_getData(dataType, data) {
  var filePanelView = this.app.views['source-dialog'].panels['file'];
  var fileElement = filePanelView.fileElement;
  if (!fileElement.files.length) {
    this.app.reset();
    this.app.views['source-dialog'].showPanel(filePanelView);
    return;
  }

  var file = fileElement.files[0];
  var reader = this.reader = new FileReader();
  reader.onloadend = (function fr_loadend(evt) {
    if (reader !== this.reader)
      return; // aborted

    var text = reader.result;
    this.app.handleData(text);
  }).bind(this);
  reader.readAsText(file, filePanelView.encodingElement.value || 'UTF-8');
};

var ListFetcher = function ListFetcher() {
  this.types = ['list', 'base64-list'];
};
ListFetcher.prototype = new Fetcher();
ListFetcher.prototype.stop = function lf_stop() {
  clearTimeout(this.timer);
};
ListFetcher.prototype.getData = function lf_getData(dataType, data) {
  var text = (dataType === 'base64-list') ?
    decodeURIComponent(escape(window.atob(data))) : data;

  var vol = 0;
  var list = [];
  text.split('\n').forEach(function eachItem(line) {
    var item = line.split('\t').reverse();
    if (!line || !item[0] || !item[1])
      return;

    item[1] = parseInt(item[1], 10);
    if (isNaN(item[1]))
      return;

    vol += item[0].length * item[1] * item[1];
    list.push(item);
  });

  // Make sure we call the handler methods as async callback.
  this.timer = setTimeout((function bf_gotData() {
    this.app.handleList(list, vol);
  }).bind(this), 0);
};

var JSONPFetcher = function JSONPFetcher() {};
JSONPFetcher.prototype = new Fetcher();
JSONPFetcher.prototype.LABEL_VERB = LoadingView.prototype.LABEL_DOWNLOADING;
JSONPFetcher.prototype.CALLBACK_PREFIX = 'JSONPCallbackX';
JSONPFetcher.prototype.TIMEOUT = 30 * 1000;
JSONPFetcher.prototype.reset =
JSONPFetcher.prototype.stop = function jpf_stop() {
  this.currentRequest = undefined;
};
JSONPFetcher.prototype.handleEvent = function jpf_handleEvent(evt) {
  var el = evt.target;
  window[el.dataset.callbackName] = undefined;
  this.currentRequest = undefined;

  el.parentNode.removeChild(el);
};
JSONPFetcher.prototype.getNewCallback = function jpf_getNewCallback() {
  // Create a unique callback name for this request.
  var callbackName = this.CALLBACK_PREFIX +
    Math.random().toString(36).substr(2, 8).toUpperCase();

  // Install the callback
  window[callbackName] = (function jpf_callback() {
    // Ignore any response that is not coming from the currentRequest.
    if (this.currentRequest !== callbackName)
      return;
    this.currentRequest = undefined;
    clearTimeout(this.timer);

    // send the callback name and the data back
    this.handleResponse.apply(this, arguments);
  }).bind(this);

  return callbackName;
};
JSONPFetcher.prototype.requestData = function jpf_requestJSONData(url) {
  var callbackName = this.currentRequest = this.getNewCallback();

  url += (url.indexOf('?') === -1) ? '?' : '&';
  url += 'callback=' + callbackName;

  var el = this.scriptElement = document.createElement('script');
  el.src = url;
  el.dataset.callbackName = callbackName;
  el.addEventListener('load', this);
  el.addEventListener('error', this);

  document.documentElement.firstElementChild.appendChild(el);

  clearTimeout(this.timer);
  this.timer = setTimeout(function jpf_timeout() {
    window[callbackName]();
  }, this.TIMEOUT);
};

var FeedFetcher = function FeedFetcher() {
  this.types = ['rss', 'feed'];

  this.params = [
    ['v', '1.0'],
    ['scoring', this.FEED_API_SCORING],
    ['num', this.FEED_API_NUM]
  ];
};
FeedFetcher.prototype = new JSONPFetcher();
FeedFetcher.prototype.FEED_API_LOAD_URL =
  'https://ajax.googleapis.com/ajax/services/feed/load';
FeedFetcher.prototype.FEED_API_CALLBACK_PREFIX = 'FeedFetcherCallback';
FeedFetcher.prototype.FEED_API_NUM = '-1';
FeedFetcher.prototype.FEED_API_SCORING = 'h';
FeedFetcher.prototype.ENTRY_REGEXP =
  /<[^>]+?>|\(.+?\.\.\.\)|\&\w+\;|<script.+?\/script\>/ig;
FeedFetcher.prototype.getData = function rf_getData(dataType, data) {
  var params = [].concat(this.params);

  params.push(['q', data]);
  params.push(['context', 'ctx']);

  var url = this.FEED_API_LOAD_URL + '?' + params.map(function kv(param) {
    return param[0] + '=' + encodeURIComponent(param[1]);
  }).join('&');

  this.requestData(url);

};
FeedFetcher.prototype.handleResponse = function rf_handleResponse(contextValue,
                                                                 responseObject,
                                                                 responseStatus,
                                                                 errorDetails) {
  // Return empty text if we couldn't get the data.
  if (!contextValue || responseStatus !== 200) {
    this.app.handleData('');
    return;
  }

  var text = [];
  responseObject.feed.entries.forEach((function process(entry) {
    text.push(entry.title);
    text.push(entry.content.replace(this.ENTRY_REGEXP, ''));
    text.push('');
  }).bind(this));
  this.app.handleData(text.join('\n'));
};

var WikipediaFetcher = function WikipediaFetcher(opts) {
  this.types = ['wiki', 'wikipedia'];

  this.params = [
    ['action', 'query'],
    ['prop', 'revisions'],
    ['rvprop', 'content'],
    ['redirects', '1'],
    ['format', 'json'],
    ['rvparse', '1']
  ];
};
WikipediaFetcher.prototype = new JSONPFetcher();
WikipediaFetcher.prototype.WIKIPEDIA_API_URL =
  'https://%lang.wikipedia.org/w/api.php';
WikipediaFetcher.prototype.DEFAULT_LANG = 'en';
WikipediaFetcher.prototype.PARSED_WIKITEXT_REGEXP =
  /<[^>]+?>|\(.+?\.\.\.\)|\&\w+\;|<script.+?\/script\>/ig;
WikipediaFetcher.prototype.getData = function wf_getData(dataType, data) {
  var params = [].concat(this.params);

  var dataTypeArr = dataType.split('.');
  var lang = (dataTypeArr[1]) ? dataTypeArr[1] : this.DEFAULT_LANG;

  if (dataTypeArr[2]) {
    params.push(['converttitles', dataTypeArr[2]]);
  }

  params.push(['titles', data]);

  var url = this.WIKIPEDIA_API_URL.replace(/%lang/, lang) + '?' +
  params.map(function kv(param) {
    return param[0] + '=' + encodeURIComponent(param[1]);
  }).join('&');

  this.requestData(url);
};
WikipediaFetcher.prototype.handleResponse = function wf_handleResponse(res) {
  if (!res) {
    this.app.handleData('');
    return;
  }

  var pageId = Object.keys(res.query.pages)[0];
  var page = res.query.pages[pageId];
  if (!('revisions' in page)) {
    this.app.handleData('');
    return;
  }

  var text = page.revisions[0]['*'].replace(this.PARSED_WIKITEXT_REGEXP, '');
  this.app.handleData(text);
};

var GooglePlusFetcher = function GooglePlusFetcher(opts) {
  this.types = ['googleplus'];

  this.params = [
    ['maxResults', '100'],
    ['alt', 'json'],
    ['pp', '1']
  ];
};
GooglePlusFetcher.prototype = new JSONPFetcher();
GooglePlusFetcher.prototype.GOOGLE_PLUS_API_URL =
  'https://www.googleapis.com/plus/v1/people/%source/activities/public';
GooglePlusFetcher.prototype.POST_REGEXP =
  /<[^>]+?>|\(.+?\.\.\.\)|\&\w+\;|<script.+?\/script\>/ig;
GooglePlusFetcher.prototype.getData = function gpf_getData(dataType, data) {
  var googlePlusPanelView =
    this.app.views['source-dialog'].panels['googleplus'];
  var accessToken = googlePlusPanelView.accessToken;

  if (!accessToken) {
    // XXX: can we login user from here?
    // User would lost the id kept in hash here.
    this.app.reset();
    this.app.views['source-dialog'].showPanel(googlePlusPanelView);
    return;
  }

  var params = [].concat(this.params);
  params.push(['access_token', accessToken]);

  var url = this.GOOGLE_PLUS_API_URL.replace(/%source/, data) + '?' +
  params.map(function kv(param) {
    return param[0] + '=' + encodeURIComponent(param[1]);
  }).join('&');

  this.requestData(url);
};
GooglePlusFetcher.prototype.handleResponse = function gpf_handleResponse(res) {
  if (!res || res.error || !res.items) {
    this.app.handleData('');
    return;
  }

  var text = res.items.map((function gpf_map(item) {
    return item.object.content.replace(this.POST_REGEXP, '');
  }).bind(this)).join('');

  this.app.handleData(text);
};

var FacebookFetcher = function FacebookFetcher() {
  this.types = ['facebook'];
};
FacebookFetcher.prototype = new Fetcher();
FacebookFetcher.prototype.LABEL_VERB = LoadingView.prototype.LABEL_DOWNLOADING;
FacebookFetcher.prototype.FACEBOOK_GRAPH_FIELDS =
  'notes.limit(500).fields(subject,message),' +
  'feed.limit(2500).fields(from.fields(id),message)';
FacebookFetcher.prototype.NOTE_REGEXP =
  /<[^>]+?>|\(.+?\.\.\.\)|\&\w+\;|<script.+?\/script\>/ig;
FacebookFetcher.prototype.stop = function fbf_stop() {
  // FB.api doesn't comes with a method to cancel the request.
  this.currentPath = undefined;
};
FacebookFetcher.prototype.getData = function fbf_getData(dataType, data) {
  var facebookPanelView = this.app.views['source-dialog'].panels['facebook'];

  // If we are not ready, bring user back to the facebook panel.
  if (!facebookPanelView.isReadyForFetch()) {

    // XXX: can we login user from here?
    // User would lost the id kept in hash here.
    this.app.reset();
    this.app.views['source-dialog'].showPanel(facebookPanelView);
    return;
  }

  var path = this.currentPath = '/' + encodeURIComponent(data) +
    '?fields=' + this.FACEBOOK_GRAPH_FIELDS;

  FB.api(path, (function gotFacebookAPIData(res) {
    // Ignore any response that does not match currentPath.
    if (this.currentPath !== path)
      return;
    this.currentPath = undefined;

    this.handleResponse(res);
  }).bind(this));
};
FacebookFetcher.prototype.handleResponse = function fbf_handleResponse(res) {
  if (res.error) {
    this.app.handleData('');
    return;
  }

  var text = [];

  if (res.notes) {
    var NOTE_REGEXP = this.NOTE_REGEXP;
    res.notes.data.forEach(function forEachNote(note) {
      if (note.subject)
        text.push(note.subject);
      if (note.message)
        text.push(note.message.replace(NOTE_REGEXP, ''));
    });
  }

  res.feed.data.forEach(function forEachData(entry) {
    // Get rid of birthday messages on the wall.
    if (entry.from.id !== res.id)
      return;

    if (entry.message)
      text.push(entry.message);
  });

  this.app.handleData(text.join('\n'));
};

var FacebookSDKLoader = function FacebookSDKLoader() {
  if (!FACEBOOK_APP_ID)
    throw 'No FACEBOOK_APP_ID defined.';

  this.loaded = false;
};
FacebookSDKLoader.prototype.load = function fsl_load(callback) {
  if (this.loaded)
    throw 'FacebookSDKLoader shouldn\'t be reused.';
  this.loaded = true;

  // If API is already available, run the callback synchronizely.
  if (window.FB) {
    callback();
    return;
  }

  // If there is already a fbAsyncInit(), we should wrap it.
  if (window.fbAsyncInit) {
    var originalFbAsyncInit = window.fbAsyncInit;
    window.fbAsyncInit = (function fbpv_fbAsyncInit() {
      window.fbAsyncInit = null;

      originalFbAsyncInit();
      callback();
    }).bind(this);

    return;
  }

  // Insert fb-root
  var el = document.createElement('div');
  el.id = 'fb-root';
  document.body.insertBefore(el, document.body.firstChild);

  // Load the SDK Asynchronously
  (function loadFacebookSDK(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement(s); js.id = id;
    js.src = '//connect.facebook.net/en_US/all.js';
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));

  var channelUrl = window.FACEBOOK_CHANNEL_URL ||
    document.location.href.replace(/\/(index.html)?(#.*)?$/i,
                                   '/facebook-channel.html');

  window.fbAsyncInit = function fbpv_fbAsyncInit() {
    window.fbAsyncInit = null;

    FB.init({
      appId: FACEBOOK_APP_ID,
      channelUrl: channelUrl
    });

    callback();
  };
};