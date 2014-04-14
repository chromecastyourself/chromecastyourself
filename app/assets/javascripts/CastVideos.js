(function() {
  'use strict';
  var MEDIA_SOURCE_ROOT = '';
  var MEDIA_SOURCE_URL = '';
  var PROGRESS_BAR_WIDTH = 600;
  var DEVICE_STATE = {
    'IDLE' : 0,
    'ACTIVE' : 1,
    'WARNING' : 2,
    'ERROR' : 3,
  };
  var PLAYER_STATE = {
    'IDLE' : 'IDLE',
    'LOADING' : 'LOADING',
    'LOADED' : 'LOADED',
    'PLAYING' : 'PLAYING',
    'PAUSED' : 'PAUSED',
    'STOPPED' : 'STOPPED',
    'SEEKING' : 'SEEKING',
    'ERROR' : 'ERROR'
  };

  var CastPlayer = function() {
    this.deviceState = DEVICE_STATE.IDLE;
    this.currentMediaSession = null;
    this.currentVolume = 0.5;
    this.autoplay = true;
    this.session = null;
    this.castPlayerState = PLAYER_STATE.IDLE;
    this.localPlayerState = PLAYER_STATE.IDLE;
    this.localPlayer = null;
    this.fullscreen = false;
    this.audio = true;
    this.currentMediaIndex = 0;
    this.currentMediaTime = 0;
    this.currentMediaDuration = -1;
    this.timer = null;
    this.progressFlag = true;
    this.timerStep = 1000;

    this.mediaContents = null;

    this.initializeCastPlayer();
    this.initializeLocalPlayer();
  };

  CastPlayer.prototype.initializeLocalPlayer = function() {
    this.localPlayer = document.getElementById('video_element')
  };

  CastPlayer.prototype.initializeCastPlayer = function() {

    if (!chrome.cast || !chrome.cast.isAvailable) {
      setTimeout(this.initializeCastPlayer.bind(this), 1000);
      return;
    }
    var applicationID = chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;

    var sessionRequest = new chrome.cast.SessionRequest(applicationID);
    var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
      this.sessionListener.bind(this),
      this.receiverListener.bind(this));

    chrome.cast.initialize(apiConfig, this.onInitSuccess.bind(this), this.onError.bind(this));

    this.addVideoThumbs();
    this.initializeUI();
  };

  CastPlayer.prototype.onInitSuccess = function() {
    console.log("init success");
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.onError = function() {
    console.log("error");
  };

  CastPlayer.prototype.sessionListener = function(e) {
    this.session = e;
    if( this.session ) {
      this.deviceState = DEVICE_STATE.ACTIVE;
      if( this.session.media[0] ) {
        this.onMediaDiscovered('activeSession', this.session.media[0]);
      }
      else {
        this.loadMedia(this.currentMediaIndex);
      }
      this.session.addUpdateListener(this.sessionUpdateListener.bind(this));
    }
  }

  CastPlayer.prototype.receiverListener = function(e) {
    if( e === 'available' ) {
      console.log("receiver found");
    }
    else {
      console.log("receiver list empty");
    }
  };

  CastPlayer.prototype.sessionUpdateListener = function(isAlive) {
    if (!isAlive) {
      this.session = null;
      this.deviceState = DEVICE_STATE.IDLE;
      this.castPlayerState = PLAYER_STATE.IDLE;
      this.currentMediaSession = null;
      clearInterval(this.timer);
      this.updateDisplayMessage();

      // continue to play media locally
      console.log("current time: " + this.currentMediaTime);
      this.playMediaLocally(this.currentMediaTime);
      this.updateMediaControlUI();
    }
  };

  CastPlayer.prototype.selectMedia = function(mediaIndex) {
    console.log("media selected" + mediaIndex);

    this.currentMediaIndex = mediaIndex;
    // reset progress bar
    var pi = document.getElementById("progress_indicator");
    var p = document.getElementById("progress");

    // reset currentMediaTime
    this.currentMediaTime = 0;

    p.style.width = '0px';
    pi.style.marginLeft = -21 - PROGRESS_BAR_WIDTH + 'px';

    if( !this.currentMediaSession ) {
      if( this.localPlayerState == PLAYER_STATE.PLAYING ) {
        this.localPlayerState = PLAYER_STATE.IDLE;
        this.playMediaLocally(0);
      }
    }
    else {
      this.castPlayerState = PLAYER_STATE.IDLE;
      this.playMedia();
    }
    this.selectMediaUpdateUI(mediaIndex);
  };

  CastPlayer.prototype.launchApp = function() {
    console.log("launching app...");
    chrome.cast.requestSession(this.onRequestSessionSuccess.bind(this), this.onLaunchError.bind(this));
    if( this.timer ) {
      clearInterval(this.timer);
    }
  };

  CastPlayer.prototype.onRequestSessionSuccess = function(e) {
    console.log("session success: " + e.sessionId);
    this.session = e;
    this.deviceState = DEVICE_STATE.ACTIVE;
    this.updateMediaControlUI();
    this.loadMedia(this.currentMediaIndex);
    this.session.addUpdateListener(this.sessionUpdateListener.bind(this));
  };

  CastPlayer.prototype.onLaunchError = function() {
    console.log("launch error");
    this.deviceState = DEVICE_STATE.ERROR;
  };

  CastPlayer.prototype.stopApp = function() {
    this.session.stop(this.onStopAppSuccess.bind(this, 'Session stopped'),
        this.onError.bind(this));

  };

  CastPlayer.prototype.onStopAppSuccess = function(message) {
    console.log(message);
    this.deviceState = DEVICE_STATE.IDLE;
    this.castPlayerState = PLAYER_STATE.IDLE;
    this.currentMediaSession = null;
    clearInterval(this.timer);
    this.updateDisplayMessage();

    console.log("current time: " + this.currentMediaTime);
    this.playMediaLocally(this.currentMediaTime);
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.loadMedia = function(mediaIndex) {
    if (!this.session) {
      console.log("no session");
      return;
    }
    console.log("loading..." + this.mediaContents[mediaIndex]['title']);
    var mediaInfo = new chrome.cast.media.MediaInfo(this.mediaContents[mediaIndex]['sources'][0]);
    mediaInfo.contentType = 'video/mp4';
    var request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = this.autoplay;
    if( this.localPlayerState == PLAYER_STATE.PLAYING ) {
      request.currentTime = this.localPlayer.currentTime;
    }
    else {
      request.currentTime = 0;
    }
    var payload = {
      "title:" : this.mediaContents[0]['title'],
      "thumb" : this.mediaContents[0]['thumb']
    };

    var json = {
      "payload" : payload
    };

    request.customData = json;

    this.castPlayerState = PLAYER_STATE.LOADING;
    this.session.loadMedia(request,
      this.onMediaDiscovered.bind(this, 'loadMedia'),
      this.onLoadMediaError.bind(this));

    document.getElementById("media_title").innerHTML = this.mediaContents[this.currentMediaIndex]['title'];
    document.getElementById("media_subtitle").innerHTML = this.mediaContents[this.currentMediaIndex]['subtitle'];
    document.getElementById("media_desc").innerHTML = this.mediaContents[this.currentMediaIndex]['description'];

  };

  CastPlayer.prototype.onMediaDiscovered = function(how, mediaSession) {
    console.log("new media session ID:" + mediaSession.mediaSessionId + ' (' + how + ')');
    this.currentMediaSession = mediaSession;
    if( how == 'loadMedia' ) {
      if( this.autoplay ) {
        this.castPlayerState = PLAYER_STATE.PLAYING;
      }
      else {
        this.castPlayerState = PLAYER_STATE.LOADED;
      }
    }

    if( how == 'activeSession' ) {
      this.castPlayerState = this.session.media[0].playerState;
      this.currentMediaTime = this.session.media[0].currentTime;
    }

    if( this.castPlayerState == PLAYER_STATE.PLAYING ) {
      this.startProgressTimer(this.incrementMediaTime);
    }

    this.currentMediaSession.addUpdateListener(this.onMediaStatusUpdate.bind(this));

    this.currentMediaDuration = this.currentMediaSession.media.duration;
    var duration = this.currentMediaDuration;
    var hr = parseInt(duration/3600);
    duration -= hr * 3600;
    var min = parseInt(duration/60);
    var sec = parseInt(duration % 60);
    if ( hr > 0 ) {
      duration = hr + ":" + min + ":" + sec;
    }
    else {
      if( min > 0 ) {
        duration = min + ":" + sec;
      }
      else {
        duration = sec;
      }
    }
    document.getElementById("duration").innerHTML = duration;

    if( this.localPlayerState == PLAYER_STATE.PLAYING ) {
      this.localPlayerState == PLAYER_STATE.STOPPED;
      var vi = document.getElementById('video_image')
      vi.style.display = 'block';
      this.localPlayer.style.display = 'none';
      this.startProgressTimer(this.incrementMediaTime);
    }
    this.updateMediaControlUI();
    this.updateDisplayMessage();
  };

  CastPlayer.prototype.onLoadMediaError = function(e) {
    console.log("media error");
    this.castPlayerState = PLAYER_STATE.IDLE;
    this.updateMediaControlUI();
    this.updateDisplayMessage();
  };

  CastPlayer.prototype.onMediaStatusUpdate = function(e) {
    if( e == false ) {
      this.currentMediaTime = 0;
      this.castPlayerState = PLAYER_STATE.IDLE;
    }
    console.log("updating media");
    this.updateProgressBar(e);
    this.updateDisplayMessage();
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.incrementMediaTime = function() {
    if( this.castPlayerState == PLAYER_STATE.PLAYING || this.localPlayerState == PLAYER_STATE.PLAYING ) {
      if( this.currentMediaTime < this.currentMediaDuration ) {
        this.currentMediaTime += 1;
        this.updateProgressBarByTimer();
      }
      else {
        this.currentMediaTime = 0;
        clearInterval(this.timer);
      }
    }
  };

  CastPlayer.prototype.playMediaLocally = function(currentTime) {
    var vi = document.getElementById('video_image')
    vi.style.display = 'none';
    this.localPlayer.style.display = 'block';
    if( this.localPlayerState != PLAYER_STATE.PLAYING && this.localPlayerState != PLAYER_STATE.PAUSED ) {
      this.localPlayer.src = this.mediaContents[this.currentMediaIndex]['sources'][0];
      this.localPlayer.load();
      this.localPlayer.addEventListener('loadeddata', this.onMediaLoadedLocally.bind(this, currentTime));
    }
    else {
      this.localPlayer.play();
      this.startProgressTimer(this.incrementMediaTime);
    }
    this.localPlayerState = PLAYER_STATE.PLAYING;
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.onMediaLoadedLocally = function(currentTime) {
    this.currentMediaDuration = this.localPlayer.duration;
    var duration = this.currentMediaDuration;

    var hr = parseInt(duration/3600);
    duration -= hr * 3600;
    var min = parseInt(duration/60);
    var sec = parseInt(duration % 60);
    if ( hr > 0 ) {
      duration = hr + ":" + min + ":" + sec;
    }
    else {
      if( min > 0 ) {
        duration = min + ":" + sec;
      }
      else {
        duration = sec;
      }
    }
    document.getElementById("duration").innerHTML = duration;
    this.localPlayer.currentTime= currentTime;
    this.localPlayer.play();
    this.startProgressTimer(this.incrementMediaTime);
  };

  CastPlayer.prototype.playMedia = function() {
    if( !this.currentMediaSession ) {
      this.playMediaLocally(0);
      return;
    }

    switch( this.castPlayerState )
    {
      case PLAYER_STATE.LOADED:
      case PLAYER_STATE.PAUSED:
        this.currentMediaSession.play(null,
          this.mediaCommandSuccessCallback.bind(this,"playing started for " + this.currentMediaSession.sessionId),
          this.onError.bind(this));
        this.currentMediaSession.addUpdateListener(this.onMediaStatusUpdate.bind(this));
        this.castPlayerState = PLAYER_STATE.PLAYING;
        this.startProgressTimer(this.incrementMediaTime);
        break;
      case PLAYER_STATE.IDLE:
      case PLAYER_STATE.LOADING:
      case PLAYER_STATE.STOPPED:
        this.loadMedia(this.currentMediaIndex);
        this.currentMediaSession.addUpdateListener(this.onMediaStatusUpdate.bind(this));
        this.castPlayerState = PLAYER_STATE.PLAYING;
        break;
      default:
        break;
    }
    this.updateMediaControlUI();
    this.updateDisplayMessage();
  };

  CastPlayer.prototype.pauseMedia = function() {
    if( !this.currentMediaSession ) {
      this.pauseMediaLocally();
      return;
    }

    if( this.castPlayerState == PLAYER_STATE.PLAYING ) {
      this.castPlayerState = PLAYER_STATE.PAUSED;
      this.currentMediaSession.pause(null,
        this.mediaCommandSuccessCallback.bind(this,"paused " + this.currentMediaSession.sessionId),
        this.onError.bind(this));
      this.updateMediaControlUI();
      this.updateDisplayMessage();
      clearInterval(this.timer);
    }
  };

  CastPlayer.prototype.pauseMediaLocally = function() {
    this.localPlayer.pause();
    this.localPlayerState = PLAYER_STATE.PAUSED;
    this.updateMediaControlUI();
    clearInterval(this.timer);
  };

  CastPlayer.prototype.stopMedia = function() {
    if( !this.currentMediaSession ) {
      this.stopMediaLocally();
      return;
    }

    this.currentMediaSession.stop(null,
      this.mediaCommandSuccessCallback.bind(this,"stopped " + this.currentMediaSession.sessionId),
      this.onError.bind(this));
    this.castPlayerState = PLAYER_STATE.STOPPED;
    clearInterval(this.timer);

    this.updateDisplayMessage();
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.stopMediaLocally = function() {
    var vi = document.getElementById('video_image')
    vi.style.display = 'block';
    this.localPlayer.style.display = 'none';
    this.localPlayer.stop();
    this.localPlayerState = PLAYER_STATE.STOPPED;
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.setReceiverVolume = function(mute) {
    var p = document.getElementById("audio_bg_level");
    if( event.currentTarget.id == 'audio_bg_track' ) {
      var pos = 100 - parseInt(event.offsetY);
    }
    else {
      var pos = parseInt(p.clientHeight) - parseInt(event.offsetY);
    }
    if( !this.currentMediaSession ) {
        this.localPlayer.volume = pos < 100 ? pos/100 : 1;
        p.style.height = pos + 'px';
        p.style.marginTop = -pos + 'px';
        return;
    }

    if( event.currentTarget.id == 'audio_bg_track' || event.currentTarget.id == 'audio_bg_level' ) {
      if( pos < 100 ) {
        var vScale = this.currentVolume * 100;
        if( pos > vScale ) {
          pos = vScale + (pos - vScale)/2;
        }
        p.style.height = pos + 'px';
        p.style.marginTop = -pos + 'px';
        this.currentVolume = pos/100;
      }
      else {
        this.currentVolume = 1;
      }
    }

    if( !mute ) {
      this.session.setReceiverVolumeLevel(this.currentVolume,
        this.mediaCommandSuccessCallback.bind(this),
        this.onError.bind(this));
    }
    else {
      this.session.setReceiverMuted(true,
        this.mediaCommandSuccessCallback.bind(this),
        this.onError.bind(this));
    }
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.muteMedia = function() {
    if( this.audio == true ) {
      this.audio = false;
      document.getElementById('audio_on').style.display = 'none';
      document.getElementById('audio_off').style.display = 'block';
      if( this.currentMediaSession ) {
        this.setReceiverVolume(true);
      }
      else {
        this.localPlayer.muted = true;
      }
    }
    else {
      this.audio = true;
      document.getElementById('audio_on').style.display = 'block';
      document.getElementById('audio_off').style.display = 'none';
      if( this.currentMediaSession ) {
        this.setReceiverVolume(false);
      }
      else {
        this.localPlayer.muted = false;
      }
    }
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.seekMedia = function(event) {
    var pos = parseInt(event.offsetX);
    var pi = document.getElementById("progress_indicator");
    var p = document.getElementById("progress");
    if( event.currentTarget.id == 'progress_indicator' ) {
      var curr = parseInt(this.currentMediaTime + this.currentMediaDuration * pos / PROGRESS_BAR_WIDTH);
      var pp = parseInt(pi.style.marginLeft) + pos;
      var pw = parseInt(p.style.width) + pos;
    }
    else {
      var curr = parseInt(pos * this.currentMediaDuration / PROGRESS_BAR_WIDTH);
      var pp = pos -21 - PROGRESS_BAR_WIDTH;
      var pw = pos;
    }

    if( this.localPlayerState == PLAYER_STATE.PLAYING || this.localPlayerState == PLAYER_STATE.PAUSED ) {
      this.localPlayer.currentTime= curr;
      this.currentMediaTime = curr;
      this.localPlayer.play();
    }

    if( this.localPlayerState == PLAYER_STATE.PLAYING || this.localPlayerState == PLAYER_STATE.PAUSED
        || this.castPlayerState == PLAYER_STATE.PLAYING || this.castPlayerState == PLAYER_STATE.PAUSED ) {
      p.style.width = pw + 'px';
      pi.style.marginLeft = pp + 'px';
    }

    if( this.castPlayerState != PLAYER_STATE.PLAYING && this.castPlayerState != PLAYER_STATE.PAUSED ) {
      return;
    }

    this.currentMediaTime = curr;
    console.log('Seeking ' + this.currentMediaSession.sessionId + ':' +
      this.currentMediaSession.mediaSessionId + ' to ' + pos + "%");
    var request = new chrome.cast.media.SeekRequest();
    request.currentTime = this.currentMediaTime;
    this.currentMediaSession.seek(request,
      this.onSeekSuccess.bind(this, 'media seek done'),
      this.onError.bind(this));
    this.castPlayerState = PLAYER_STATE.SEEKING;

    this.updateDisplayMessage();
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.onSeekSuccess = function(info) {
    console.log(info);
    this.castPlayerState = PLAYER_STATE.PLAYING;
    this.updateDisplayMessage();
    this.updateMediaControlUI();
  };

  CastPlayer.prototype.mediaCommandSuccessCallback = function(info, e) {
    console.log(info);
  };

  CastPlayer.prototype.updateProgressBar = function(e) {
    var p = document.getElementById("progress");
    var pi = document.getElementById("progress_indicator");
    if( e.idleReason == 'FINISHED' && e.playerState == 'IDLE' ) {
      p.style.width = '0px';
      pi.style.marginLeft = -21 - PROGRESS_BAR_WIDTH + 'px';
      clearInterval(this.timer);
      this.castPlayerState = PLAYER_STATE.STOPPED;
      this.updateDisplayMessage();
    }
    else {
      p.style.width = Math.ceil(PROGRESS_BAR_WIDTH * e.currentTime / this.currentMediaSession.media.duration + 1) + 'px';
      this.progressFlag = false;
      setTimeout(this.setProgressFlag.bind(this),1000);
      var pp = Math.ceil(PROGRESS_BAR_WIDTH * e.currentTime / this.currentMediaSession.media.duration);
      pi.style.marginLeft = -21 - PROGRESS_BAR_WIDTH + pp + 'px';
    }
  };

  CastPlayer.prototype.setProgressFlag = function() {
    this.progressFlag = true;
  };

  CastPlayer.prototype.updateProgressBarByTimer = function() {
    var p = document.getElementById("progress");
    if( isNaN(parseInt(p.style.width)) ) {
      p.style.width = 0;
    }
    if( this.currentMediaDuration > 0 ) {
      var pp = Math.floor(PROGRESS_BAR_WIDTH * this.currentMediaTime/this.currentMediaDuration);
    }

    if( this.progressFlag ) {
      p.style.width = pp + 'px';
      var pi = document.getElementById("progress_indicator");
      pi.style.marginLeft = -21 - PROGRESS_BAR_WIDTH + pp + 'px';
    }

    if( pp > PROGRESS_BAR_WIDTH ) {
      clearInterval(this.timer);
      this.deviceState = DEVICE_STATE.IDLE;
      this.castPlayerState = PLAYER_STATE.IDLE;
      this.updateDisplayMessage();
      this.updateMediaControlUI();
    }
  };

  CastPlayer.prototype.updateDisplayMessage = function() {
    if( this.deviceState != DEVICE_STATE.ACTIVE || this.castPlayerState == PLAYER_STATE.IDLE || this.castPlayerState == PLAYER_STATE.STOPPED ) {
      document.getElementById("playerstate").style.display = 'none';
      document.getElementById("playerstatebg").style.display = 'none';
      document.getElementById("play").style.display = 'block';
      document.getElementById("video_image_overlay").style.display = 'none';
    }
    else {
      document.getElementById("playerstate").style.display = 'block';
      document.getElementById("playerstatebg").style.display = 'block';
      document.getElementById("video_image_overlay").style.display = 'block';
      document.getElementById("playerstate").innerHTML = this.castPlayerState
        + " on " + this.session.receiver.friendlyName;
    }
  }

  CastPlayer.prototype.updateMediaControlUI = function() {
    if( this.deviceState == DEVICE_STATE.ACTIVE ) {
      document.getElementById("casticonactive").style.display = 'block';
      document.getElementById("casticonidle").style.display = 'none';
      var playerState = this.castPlayerState;
    }
    else {
      document.getElementById("casticonidle").style.display = 'block';
      document.getElementById("casticonactive").style.display = 'none';
      var playerState = this.localPlayerState;
    }

    switch( playerState )
    {
      case PLAYER_STATE.LOADED:
      case PLAYER_STATE.PLAYING:
        document.getElementById("play").style.display = 'none';
        document.getElementById("pause").style.display = 'block';
        break;
      case PLAYER_STATE.PAUSED:
      case PLAYER_STATE.IDLE:
      case PLAYER_STATE.LOADING:
      case PLAYER_STATE.STOPPED:
        document.getElementById("play").style.display = 'block';
        document.getElementById("pause").style.display = 'none';
        break;
      default:
        break;
    }
  }

  CastPlayer.prototype.selectMediaUpdateUI = function(mediaIndex) {
    document.getElementById('video_image').src = MEDIA_SOURCE_ROOT + this.mediaContents[mediaIndex]['thumb'];
    document.getElementById("progress").style.width = '0px';
    document.getElementById("media_title").innerHTML = this.mediaContents[mediaIndex]['title'];
    document.getElementById("media_subtitle").innerHTML = this.mediaContents[mediaIndex]['subtitle'];
    document.getElementById("media_desc").innerHTML = this.mediaContents[mediaIndex]['description'];
  };

  CastPlayer.prototype.initializeUI = function() {
    document.getElementById("media_title").innerHTML = this.mediaContents[0]['title'];
    document.getElementById("media_subtitle").innerHTML = this.mediaContents[this.currentMediaIndex]['subtitle'];
    document.getElementById("media_desc").innerHTML = this.mediaContents[this.currentMediaIndex]['description'];

    document.getElementById("casticonidle").addEventListener('click', this.launchApp.bind(this));
    document.getElementById("casticonactive").addEventListener('click', this.stopApp.bind(this));
    document.getElementById("progress_bg").addEventListener('click', this.seekMedia.bind(this));
    document.getElementById("progress").addEventListener('click', this.seekMedia.bind(this));
    document.getElementById("progress_indicator").addEventListener('dragend', this.seekMedia.bind(this));
    document.getElementById("audio_on").addEventListener('click', this.muteMedia.bind(this));
    document.getElementById("audio_off").addEventListener('click', this.muteMedia.bind(this));
    document.getElementById("audio_bg").addEventListener('mouseover', this.showVolumeSlider.bind(this));
    document.getElementById("audio_on").addEventListener('mouseover', this.showVolumeSlider.bind(this));
    document.getElementById("audio_bg_level").addEventListener('mouseover', this.showVolumeSlider.bind(this));
    document.getElementById("audio_bg_track").addEventListener('mouseover', this.showVolumeSlider.bind(this));
    document.getElementById("audio_bg_level").addEventListener('click', this.setReceiverVolume.bind(this, false));
    document.getElementById("audio_bg_track").addEventListener('click', this.setReceiverVolume.bind(this, false));
    document.getElementById("audio_bg").addEventListener('mouseout', this.hideVolumeSlider.bind(this));
    document.getElementById("audio_on").addEventListener('mouseout', this.hideVolumeSlider.bind(this));
    document.getElementById("media_control").addEventListener('mouseover', this.showMediaControl.bind(this));
    document.getElementById("media_control").addEventListener('mouseout', this.hideMediaControl.bind(this));
    document.getElementById("fullscreen_expand").addEventListener('click', this.requestFullScreen.bind(this));
    document.getElementById("fullscreen_collapse").addEventListener('click', this.cancelFullScreen.bind(this));
    document.addEventListener("fullscreenchange", this.changeHandler.bind(this), false);
    document.addEventListener("webkitfullscreenchange", this.changeHandler.bind(this), false);

    document.getElementById("play").addEventListener('click', this.playMedia.bind(this));
    document.getElementById("pause").addEventListener('click', this.pauseMedia.bind(this));
    document.getElementById("progress_indicator").draggable = true;

  };

  CastPlayer.prototype.showMediaControl = function() {
  };

  CastPlayer.prototype.hideMediaControl = function() {
  };

  CastPlayer.prototype.showVolumeSlider = function() {
    document.getElementById('audio_bg').style.opacity = 1;
    document.getElementById('audio_bg_track').style.opacity = 1;
    document.getElementById('audio_bg_level').style.opacity = 1;
    document.getElementById('audio_indicator').style.opacity = 1;
  };

  CastPlayer.prototype.hideVolumeSlider = function() {
    document.getElementById('audio_bg').style.opacity = 0;
    document.getElementById('audio_bg_track').style.opacity = 0;
    document.getElementById('audio_bg_level').style.opacity = 0;
    document.getElementById('audio_indicator').style.opacity = 0;
  };

  CastPlayer.prototype.requestFullScreen = function() {
    var element = document.getElementById("video_element");
    var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen;

    if (requestMethod) {
      requestMethod.call(element);
      console.log("requested fullscreen");
    }
  };

  CastPlayer.prototype.cancelFullScreen = function() {
    var requestMethod = document.cancelFullScreen || document.webkitCancelFullScreen;

    if (requestMethod) {
      requestMethod.call(document);
    }
  };

  CastPlayer.prototype.changeHandler = function(){
    if (this.fullscreen) {
      document.getElementById('fullscreen_expand').style.display = 'block';
      document.getElementById('fullscreen_collapse').style.display = 'none';
      this.fullscreen = false;
    }
    else {
      document.getElementById('fullscreen_expand').style.display = 'none';
      document.getElementById('fullscreen_collapse').style.display = 'block';
      this.fullscreen = true;
    }
  };

  CastPlayer.prototype.startProgressTimer = function(callback) {
    if( this.timer ) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.timer = setInterval(callback.bind(this), this.timerStep);
  };

  CastPlayer.prototype.retrieveMediaJSON = function(src) {
    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', this.onMediaJsonLoad.bind(this));
    xhr.addEventListener('error', this.onMediaJsonError.bind(this));
    xhr.open('GET', src);
    xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
    xhr.responseType = "json";
    xhr.send(null);
  };

  CastPlayer.prototype.onMediaJsonLoad = function(evt) {
    var responseJson = evt.srcElement.response;
    this.mediaContents = responseJson['categories'][0]['videos'];
    var ni = document.getElementById('carousel');
    var newdiv = null;
    var divIdName = null;
    for( var i = 0; i < this.mediaContents.length; i++ ) {
      newdiv = document.createElement('div');
      divIdName = 'thumb'+i+'Div';
      newdiv.setAttribute('id',divIdName);
      newdiv.setAttribute('class','col-md-3');
      newdiv.innerHTML = '<img src="' + MEDIA_SOURCE_ROOT + this.mediaContents[i]['thumb'] + '" class="col-md-3">';
      newdiv.addEventListener('click', this.selectMedia.bind(this, i));
      ni.appendChild(newdiv);
    }
  }

  CastPlayer.prototype.onMediaJsonError = function() {
    console.log("Let's ride your videos !");
  }

  CastPlayer.prototype.addVideoThumbs = function() {
    this.mediaContents = mediaJSON['categories'][0]['videos'];
    var ni = document.getElementById('carousel');
    var newdiv = null;
    var newdivBG = null;
    var divIdName = null;
    for( var i = 0; i < this.mediaContents.length; i++ ) {
      newdiv = document.createElement('div');
      divIdName = 'thumb'+i+'Div';
      newdiv.setAttribute('id',divIdName);
      newdiv.setAttribute('class','col-md-3 m-mainwrapper--thumb');
      newdiv.innerHTML = '<div class="m-mainwrapper--thumb--image--container"><img src="' + MEDIA_SOURCE_ROOT + this.mediaContents[i]['thumb'] + '" class="m-mainwrapper--thumb--image"></div><p class="m-mainwrapper--thumb--p">' + this.mediaContents[i]['title'] + '</p>';
      newdiv.addEventListener('click', this.selectMedia.bind(this, i));
      ni.appendChild(newdiv);
    }
  }

 window.CastPlayer = CastPlayer;
})();
