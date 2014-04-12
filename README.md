# Chromecast yourself - Work in progress

## What is that ?

> This rails app give you the power of streaming your *.mp4* films (stored in your computer) on your [Chromecast](http://www.google.com/intl/fr/chrome/devices/chromecast/index.html).

## How it works ?

This app works really simply

### First:

> ```sh
git clone git@github.com:rdlh/chromecastyourself.git
cd chromecastyourself
bundle
```

### Second:

> put your `.mp4` films on the `public/movies` directory

### Third:

> launch unicorn server
```sh
unicorn
```

### Fourth:

> Check [http://localhost:8080/](http://localhost:8080/) and let's stream your films !
