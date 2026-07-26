# CuidaLocal Android

Wrapper Android do CuidaLocal v1.2.0, feito com Capacitor 8 e `@capacitor/local-notifications`.

## Comportamento dos alarmes

- compromissos futuros são agendados uma vez, na data e horário cadastrados;
- cada horário de medicamento ativo é agendado diariamente;
- salvar, editar, excluir, restaurar backup ou limpar dados sincroniza a lista de notificações pendentes;
- os IDs são determinísticos, evitando duplicação após reiniciar o aplicativo;
- o plugin restaura notificações após reinicialização do Android;
- notificações e alarmes exatos dependem das permissões do Android;
- os dados ficam no armazenamento local da WebView; backup em nuvem do aplicativo está desativado.

## Build

O webDir é `../v2-app`. JDK 21 e Android SDK devem estar disponíveis.

```bash
export JAVA_HOME=/home/deploy/.local/jdks/temurin-21
export ANDROID_HOME=/home/deploy/android-sdk
export ANDROID_SDK_ROOT=/home/deploy/android-sdk
npm install
npm run build:debug
npm run build:release
```

O release é assinado com a chave privada local indicada por `~/.config/cuidalocal-signing/signing.properties`. A chave e as senhas não pertencem ao repositório e precisam de backup seguro: sem a mesma chave, o Android não aceita uma atualização sobre a instalação existente.

Artefato esperado:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## Limites

Alarmes locais não são garantia médica. Eles podem falhar se o aparelho estiver desligado, se as permissões forem removidas, se o aplicativo for desinstalado ou se o fabricante aplicar restrição extrema de bateria. A versão PWA depende do calendário do aparelho para avisar de forma confiável com o navegador fechado.
