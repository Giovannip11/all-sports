# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Rodando no celular (com mapa real)

Este projeto usa `react-native-maps`, que **não é suportado pelo app Expo Go** (desde o SDK 51 o Expo Go não inclui mais módulos de mapa nativos) — abrir o app pelo Expo Go faz o app fechar sozinho ao tentar renderizar o mapa.

Para testar com o mapa real em um iPhone/Android físico, é preciso instalar um **dev client** (build próprio do app, feito uma vez):

```bash
npx expo install expo-dev-client   # já incluído neste projeto
npx eas build --profile development --platform ios
```

Isso gera um link de instalação (precisa de conta gratuita no [expo.dev](https://expo.dev) e, para iOS, de um dispositivo registrado no seu Apple Developer / Ad Hoc). Instale esse build no celular no lugar do Expo Go.

Depois, para rodar o servidor de desenvolvimento, use `--dev-client` em vez de abrir o Expo Go:

```bash
npx expo start --dev-client --tunnel
```

### Testando sem build nativo (web)

Se só quer validar fluxos de login/eventos/notificações sem precisar do build nativo, rode no navegador — não usa `react-native-maps` (tem um mapa estilizado próprio para web que já usa a localização real do navegador):

```bash
npx expo start --tunnel
# pressione "w" para abrir no navegador
```

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
