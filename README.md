# Lumina Notes

Lumina é um aplicativo offline-first de anotações, diário, lembretes, calendário, demandas, anexos, conversas e organização pessoal.

A partir da linha **2.0**, o mesmo projeto passa a atender duas plataformas sem abandonar a versão original:

- **Desktop:** Electron + `better-sqlite3` + IPC/preload.
- **Android:** Capacitor 8 + SQLite nativo + APIs Android.

> Branch de desenvolvimento: `feat/lumina-mobile-android-v2`  
> Rollback: `backup/lumina-before-mobile-20260902`

## Arquitetura

```text
Renderer compartilhado (HTML + CSS + JavaScript)
                 │
          window.lumina
                 │
       ┌─────────┴─────────┐
       │                   │
Desktop Adapter        Android Adapter
Electron preload       Capacitor plugins
       │                   │
better-sqlite3         SQLite nativo
safeStorage            Secure Storage
Electron Notification  Local Notifications
filesystem/dialog      Filesystem/Share/Location
```

O renderer não precisa espalhar `if (android)`/`if (electron)` pelas features. O contrato principal continua sendo `window.lumina`.

## Funcionalidades preservadas

- notas: criar, editar, excluir, pesquisar, tags, favoritas, fixadas, cores e anexos;
- diário com humor e cronologia;
- lembretes vinculáveis a notas;
- calendário e eventos;
- demandas e etapas;
- perfil e contas locais;
- temas e preferências;
- imagens, vídeo, áudio, PDF e outros arquivos;
- backup/exportação desktop `.lmn`;
- chat de IA e histórico;
- usuários, mensagens, bloqueio, arquivamento e compartilhamento;
- descoberta/rede local no desktop.

## Evolução Android

- onboarding na primeira abertura;
- splash sem tela branca;
- bottom navigation própria para smartphone;
- action sheet central para Nota, Diário, Lembrete, Evento e Demanda;
- modo leitura separado da edição;
- toolbar de formatação leve e autosave no editor móvel;
- anexos via seletor de arquivos do Android;
- SQLite local versionado;
- lixeira restaurável;
- histórico de versões de notas;
- busca global entre notas, lembretes, eventos, demandas e conversas;
- alarmes locais com soneca;
- lembretes por Local Notifications, inclusive com app fora de foco dentro das regras do Android;
- compartilhamento pelo menu nativo;
- localização somente quando o usuário solicitar;
- chave de IA em armazenamento seguro;
- layout para smartphone, safe areas, teclado e reduced motion.

## Segurança

O desktop é iniciado por `src/main/bootstrap.js`, que aplica guardas antes do processo principal existente:

- `webSecurity: true`;
- `nodeIntegration: false` e `contextIsolation: true`;
- bloqueio de navegação arbitrária dentro do WebView;
- validação de caminhos de anexos;
- leitura externa apenas após seleção explícita em diálogo;
- normalização de tags antes do IPC;
- chave de IA criptografada com `safeStorage` do Electron;
- listener IPC removível corretamente.

No Android:

- senha local derivada com PBKDF2-SHA256 e salt aleatório;
- banco no armazenamento privado do aplicativo;
- chave de IA em Secure Storage/Android Keystore;
- tráfego HTTP em claro bloqueado;
- permissões são solicitadas em runtime quando o recurso é usado;
- dados continuam disponíveis offline.

## Pré-requisitos

### Desktop

- Node.js 22 recomendado;
- npm;
- Windows 10/11 para gerar/testar o instalador Windows.

### Android

- Node.js 22+;
- Java 21;
- Android SDK compatível com Capacitor 8;
- Android Studio é opcional para desenvolvimento, mas útil para emulador/dispositivo.

## Desenvolvimento desktop

```bash
npm install
npm start
```

Build Windows:

```bash
npm run build:win
```

Saída em `dist/`.

## Desenvolvimento Android

Na primeira vez:

```bash
npm install
npm run android:add
node scripts/configure-android.js
```

Depois de mudanças web/plugins:

```bash
npm run android:sync
node scripts/configure-android.js
```

Abrir no Android Studio:

```bash
npm run android:open
```

Build manual do APK debug:

```bash
cd android
./gradlew assembleDebug
```

No Windows use `gradlew.bat assembleDebug`.

O APK é gerado em:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

A CI copia e publica esse arquivo como `Lumina-Notes.apk`.

## Banco de dados

### Desktop

Continua em:

```text
%APPDATA%\lumina-notes\lumina.db
```

A arquitetura e os dados antigos não são apagados por esta atualização.

### Android

O adaptador `src/renderer/js/mobile-platform.js` usa `@capacitor-community/sqlite` e migrations versionadas. O schema inclui contas, notas, versões, lembretes, eventos, configurações, demandas, chat, mensagens, compartilhamentos e alarmes.

A exclusão móvel é **soft delete** (`deleted_at`) até a exclusão definitiva na lixeira.

## Permissões Android

O Manifest declara apenas capacidades necessárias ao conjunto de recursos e o app solicita em runtime quando aplicável:

- notificações;
- vibração/reagendamento após reinício;
- alarme exato quando permitido pelo sistema;
- câmera;
- microfone;
- localização aproximada/precisa.

A localização não é rastreada em segundo plano.

## Backup

Desktop mantém exportação/importação `.lmn` existente.

Android já exporta snapshot estruturado compartilhável. A importação completa do `.lmn` desktop permanece bloqueada até existir conversão transacional segura de banco + anexos; não é feita importação parcial silenciosa.

## IA

A chave pessoal do usuário não deve ser commitada. Desktop usa `safeStorage`; Android usa armazenamento seguro. A IA sempre atua sob ação explícita do usuário.

## Rede local

A implementação Electron existente foi preservada. No Android o contrato continua presente, mas retorna erro explícito enquanto não houver um transporte LAN móvel autenticado e revisado. Isso evita remover a função silenciosamente ou abrir uma superfície insegura.

## CI e testes

`.github/workflows/android-build.yml` executa:

1. validação sintática dos JavaScripts/configurações;
2. instalação das dependências;
3. geração/sync do Capacitor Android;
4. configuração de Manifest/recursos;
5. build Gradle `assembleDebug`;
6. verificação de integridade ZIP do APK e SHA-256;
7. upload de `Lumina-Notes.apk` como artefato;
8. build Windows com `electron-builder` para regressão.

## Auditoria e migrations

- `docs/AUDIT-V2.md` — inventário e problemas encontrados no código real;
- `scripts/configure-android.js` — hardening/configuração determinística do projeto Android gerado;
- `mobile-platform.js` — persistência e APIs nativas Android;
- `mobile-ui.js` / `mobile.css` — adaptação de UX sem reescrever o desktop.

## Troubleshooting

Se `better-sqlite3` falhar no desktop:

```bash
npm rebuild better-sqlite3
```

Se plugins Android mudarem:

```bash
npm run android:sync
node scripts/configure-android.js
```

Se o Gradle estiver com cache inconsistente:

```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

## Estado de recursos que dependem de infraestrutura externa

Recuperação de senha por e-mail e sincronização em nuvem não são simuladas. O modelo atual de conta é local; essas funções exigem um backend de identidade/sincronização antes de serem oferecidas como funcionais.
