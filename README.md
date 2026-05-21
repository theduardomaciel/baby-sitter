# Baby Sitter

Aplicação de monitoramento por câmera com detecção de movimento, transmissão de vídeo em tempo real e alertas visuais, sonoros e por vibração no navegador.

Quando o app está em execução, a tela principal também mostra um QR Code com o endereço da interface web para abrir a página em outro dispositivo na mesma rede.

## Funcionalidades

- Transmissão da câmera em tempo real pela interface web.
- Detecção de movimento com destaque visual na tela.
- Alertas sonoros configuráveis no navegador.
- Vibração no dispositivo quando suportado.
- QR Code gerado automaticamente com a URL atual do servidor.
- Empacotamento com PyInstaller para gerar executável no Windows e no Arch Linux.

## Requisitos

- Python 3.11 ou superior.
- Acesso a uma câmera compatível com OpenCV.
- Dependências instaladas via `requirements.txt`.

## Instalação

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

No Linux, ative a virtualenv com o comando equivalente do seu shell.

## Executar o app

```bash
python main.py
```

Depois abra o navegador em:

```text
http://127.0.0.1:5000
```

Se você abrir o app em outra máquina da rede, o QR Code exibido na página aponta para a URL acessível naquele ambiente.

## Gerar executável

O projeto inclui o script [build.py](build.py) para empacotar a aplicação com PyInstaller.

### Windows

```bash
python build.py
```

O executável será gerado com o nome `baby-sitter` na pasta `dist`.

### Arch Linux

```bash
python build.py
```

Execute o build no próprio Arch Linux para gerar o binário compatível com esse sistema.

## CI e releases

O repositório possui um workflow em [`.github/workflows/build.yml`](.github/workflows/build.yml) que, a cada push em `main`, gera os binários para Windows e Arch Linux e cria automaticamente uma release no GitHub com os artefatos anexados.

A release usa a versão definida no arquivo [VERSION](VERSION) e gera a tag no formato `vX.Y.Z`. Antes de publicar uma nova release, atualize esse arquivo com a próxima versão semântica.

## Estrutura principal

- [main.py](main.py): ponto de entrada da aplicação.
- [baby_sitter/web.py](baby_sitter/web.py): cria a aplicação Flask, expõe as rotas e gera o QR Code.
- [baby_sitter/templates/index.html](baby_sitter/templates/index.html): interface principal.
- [baby_sitter/static/css/app.css](baby_sitter/static/css/app.css): estilos da interface.
- [baby_sitter/static/js/app.js](baby_sitter/static/js/app.js): lógica do navegador para alertas e eventos de movimento.
- [build.py](build.py): script de empacotamento com PyInstaller.

## Observações

- O acesso por QR Code funciona melhor quando o servidor está escutando em um IP acessível na rede local.
- Em sistemas sem câmera disponível, a transmissão de vídeo não vai iniciar.
- O build nativo deve ser feito no sistema operacional de destino.
