# Auditoria técnica — Lumina Notes 2.0

Base auditada: `main` em `2c9195fcccd0582f3e36e9ae5f5151995edebc95`.

## Inventário encontrado no código

Além do README original, o código já possuía:

- contas locais múltiplas, perfil, avatar, bio, cidade, estado e aniversário;
- sessão local de 30 dias (existia no main, mas o renderer não a consumia corretamente);
- notas e diário no mesmo modelo, humor, tags, cores, fixadas, favoritas, anexos e busca;
- histórico mínimo de exclusões;
- lembretes associados a notas e janela/notificação desktop;
- calendário mensal e eventos;
- demandas com status, prioridade e etapas com imagem;
- conversas com IA e histórico de mensagens;
- descoberta LAN e envio entre peers;
- mensagens entre usuários locais, bloqueio, arquivamento e compartilhamento de itens;
- backup `.lmn`, importação e cópia de anexos;
- temas, cor de destaque, tamanho de fonte e outras preferências;
- visualizador de mídia e anexos de imagem, vídeo, áudio e documentos.

## Problemas confirmados

### Funcionais

1. O checkbox **Continuar conectado** existia, mas `App.auth.login()` não enviava `remember` ao processo principal.
2. O logout do renderer não chamava `auth.clearSession()`.
3. Bio, cidade, estado e aniversário apareciam no perfil, mas `saveProfile()` não os enviava ao banco.
4. A UI apontava para `App.settings.saveApiKey()`, porém esse método não estava implementado no trecho de settings auditado.
5. A exclusão de notas gravava apenas título/tipo no `notes_history` e depois apagava o conteúdo: não era uma lixeira restaurável nem histórico de versões.
6. A abertura de notas levava diretamente ao editor; não havia modo leitura independente.
7. O editor dependia de salvamento manual e não tinha autosave.
8. Anexos e mensagens ainda usavam alguns emojis como ícones.

### Segurança

1. `BrowserWindow` estava com `webSecurity: false`.
2. IPC de arquivos aceitava caminhos arbitrários para leitura/abertura/exclusão.
3. O renderer enviava a chave de IA por IPC e não havia armazenamento seguro dedicado.
4. `utils.sanitize()` escapava apenas `<` e `>`, insuficiente para atributos/handlers HTML.
5. Mensagens/anexos grandes podem crescer o SQLite por uso de dados inline em alguns fluxos.
6. A arquitetura LAN precisa de autenticação/validação mais forte antes de ser promovida para sincronização entre dispositivos.

### Arquitetura

- `app.js`, `database.js`, `main.js`, `index.html` e `main.css` concentram responsabilidades demais.
- O renderer dependia diretamente do bridge Electron (`window.lumina`) sem implementação equivalente em outras plataformas.
- Migrações desktop eram executadas com `try/catch` silencioso, sem tabela formal de versão.

## Estratégia adotada

- preservar o Electron e a UI existentes;
- transformar `window.lumina` no contrato de plataforma;
- desktop: Electron IPC protegido por `bootstrap.js` e `preload.js`;
- Android: Capacitor 8 + SQLite nativo, Preferences, Local Notifications, Filesystem, Share, Geolocation e Secure Storage;
- adicionar migrations/versionamento no banco Android;
- aplicar evolução móvel de forma progressiva em `mobile-ui.js` e `mobile.css`, sem reescrever o renderer inteiro;
- manter a branch `backup/lumina-before-mobile-20260902` como ponto de rollback.

## Pontos que continuam exigindo backend/etapa futura

- recuperação de senha por e-mail não é fingida: contas atuais são locais e não existe servidor de identidade/e-mail;
- sincronização desktop ↔ Android/nuvem ainda não possui servidor; os IDs/timestamps e repositórios móveis foram preparados para isso;
- LAN no Android é explicitamente sinalizada como indisponível até existir transporte móvel autenticado, em vez de ser removida silenciosamente;
- reverse geocoding depende de provedor externo; coordenadas são obtidas somente sob solicitação e endereço permanece editável;
- importação móvel completa do formato `.lmn` desktop requer normalização transacional de anexos e ficou bloqueada em vez de importar parcialmente e corromper dados.
