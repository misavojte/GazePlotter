# GazePlotter

Server-less web application to show eye-tracking data from different eye-trackers in interactive sequential charts.

## Set-up dev environment
GazePlotter uses Vite.js to build the app from TypeScript modules. The development set-up requires that you have Node (14 or higher) installed.

### Quick start
To start Vite server and run dev version of project locally, use:
```
npm install
npm run dev
```

## Before commit
Make sure you comply with the standards of projects (implementing MVC interfaces to Front components) and there are no errors and warnings produced by ESLint:
```
npx eslint src/ts
```
You can automatically beautify code by using --fix flag:
```
npx eslint src/ts --fix
```