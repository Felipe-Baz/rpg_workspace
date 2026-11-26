// GERADO por scripts/dnd5e/gerar-opcoes-classe.mjs a partir de classes.json. Não editar à mão.
export type OpcaoTexto = { id: string; nome: string; texto: string; nivel?: number };
export const METAMAGIAS: OpcaoTexto[] = [
  {
    "id": "magia-acelerada",
    "nome": "Magia Acelerada",
    "texto": "Quando você conjurar uma magia que tenha um tempo de conjuração de 1 ação, você pode gastar 2 pontos de feitiçaria para mudar o tempo de conjuração para 1 ação bônus para essa magia."
  },
  {
    "id": "magia-aumentada",
    "nome": "Magia Aumentada",
    "texto": "Quando você conjura uma magia que obriga uma criatura a realizar um teste de resistência contra o seu efeito, você pode gastar 3 pontos de feitiçaria para dar desvantagem a um alvo da magia no primeiro teste de resistência feito contra ela."
  },
  {
    "id": "magia-cuidadosa",
    "nome": "Magia Cuidadosa",
    "texto": "Quando você conjurar uma magia que obriga outras criaturas a realizarem um teste de resistência, você pode proteger algumas dessas criaturas da força total da magia. Para tanto, você gasta 1 ponto de feitiçaria e escolhe um número dessas criaturas até o seu modificador de Carisma (mínimo de uma criatura). Uma criatura escolhida passa automaticamente no teste de resistência contra a magia."
  },
  {
    "id": "magia-distante",
    "nome": "Magia Distante",
    "texto": "Quando você conjurar uma magia que tenha distância de 1,5 metro ou maior, você pode gastar 1 ponto de feitiçaria para dobrar o alcance da magia.\n\nQuando você conjura uma magia com alcance de toque, você pode gastar 1 ponto de feitiçaria para mudar o alcance da magia para 9 metros."
  },
  {
    "id": "magia-duplicada",
    "nome": "Magia Duplicada",
    "texto": "Quando você conjurar uma magia que seja incapaz de ter mais de uma criatura como alvo no nível atual dela e não possua alcance pessoal, você pode gastar um número de pontos de feitiçaria igual ao nível da magia para ter uma segunda criatura, no alcance da magia, como alvo (1 ponto de feitiçaria se a magia for um truque)."
  },
  {
    "id": "magia-estendida",
    "nome": "Magia Estendida",
    "texto": "Quando você conjurar uma magia que tenha duração de 1 minuto ou maior, você pode gastar 1 ponto de feitiçaria para dobrar sua duração, até uma duração máxima de 24 horas."
  },
  {
    "id": "magia-potencializada",
    "nome": "Magia Potencializada",
    "texto": "Quando você rola o dano de uma magia, você pode gastar 1 ponto de feitiçaria para jogar novamente um número de dados de dano, até seu modificador de Carisma (mínimo de um). Você deve usar a nova rolagem.\n\nVocê pode usar Magia Potencializada mesmo que você já tenha usado uma opção diferente de Metamágica durante a conjuração da magia."
  },
  {
    "id": "magia-sutil",
    "nome": "Magia Sutil",
    "texto": "Quando você conjurar uma magia, você pode gastar 1 ponto de feitiçaria para fazê-lo sem qualquer componente somático ou verbal."
  }
];
export const MANOBRAS: OpcaoTexto[] = [
  {
    "id": "aparar",
    "nome": "Aparar",
    "texto": "Quando outra criatura causar dano a você com um ataque corpo-a-corpo, você pode usar sua reação e gastar um dado de superioridade para reduzir o dano pelo número rolado no dado de superioridade + seu modificador de Destreza."
  },
  {
    "id": "ataque-ameacador",
    "nome": "Ataque Ameaçador",
    "texto": "Quando você atingir uma criatura com um ataque com arma, você pode gastar um dado de superioridade para tentar amedrontar o alvo. Você adiciona seu dado de superioridade a jogada de dano do ataque e o alvo deve realizar um teste de resistência de Sabedoria. Se falhar, ele ficará com medo de você até o final do seu próximo turno."
  },
  {
    "id": "ataque-de-encontrao",
    "nome": "Ataque de Encontrão",
    "texto": "Quando você atingir uma criatura com um ataque com arma, você pode gastar um dado de superioridade para tentar empurrar o alvo para trás. Você adiciona seu dado de superioridade a jogada de dano do ataque e, se o alvo for Grande ou menor, ele deve realizar um teste de resistência de Força. Se falhar, você empurra o alvo para até 4,5 metros de você."
  },
  {
    "id": "ataque-de-finta",
    "nome": "Ataque de Finta",
    "texto": "Você pode gastar um dado de superioridade e usar uma ação bônus, no seu turno, para fintar, escolhendo uma criatura a 1,5 metro de você como alvo. Você tem vantagem na sua próxima jogada de ataque contra essa criatura, nesse turno. Se o ataque atingir, você adiciona seu dado de superioridade ao dano do ataque."
  },
  {
    "id": "ataque-de-manobra",
    "nome": "Ataque de Manobra",
    "texto": "Quando você atingir uma criatura com um ataque com arma, você pode gastar um dado de superioridade para tentar manobrar um de seus companheiros para uma posição mais vantajosa. Você adiciona seu dado de superioridade a jogada de dano do ataque e escolhe uma criatura amigável que possa ver ou ouvir você. Aquela criatura pode usar sua reação para se mover até metade do seu deslocamento, sem provocar ataques de oportunidade do alvo do seu ataque."
  },
  {
    "id": "ataque-de-precisao",
    "nome": "Ataque de Precisão",
    "texto": "Quando você realizar uma jogada de ataque com arma contra uma criatura, você pode gastar um dado de superioridade para adicioná-lo a jogada. Você pode usar essa manobra antes ou depois de realizar a jogada de ataque, mas deve usá-la antes de qualquer efeito do ataque ser aplicado."
  },
  {
    "id": "ataque-desarmante",
    "nome": "Ataque Desarmante",
    "texto": "Quando você atingir uma criatura com um ataque com arma, você pode gastar um dado de superioridade para tentar desarmar o alvo, forçando-o a derrubar um item, à sua escolha, que ele esteja empunhando. Você adiciona o dado de superioridade a jogada de dano do ataque e o alvo deve realizar um teste de resistência de Força. Se fracassar, ele derrubará o objeto escolhido. O objeto cai aos pés dele."
  },
  {
    "id": "ataque-estendido",
    "nome": "Ataque Estendido",
    "texto": "Quando você atingir uma criatura com um ataque corpo-a-corpo com arma, você pode gastar um dado de superioridade para aumentar o alcance do seu ataque em 1,5 metro. Se você atingir, você adiciona o seu dado de superioridade ao dano causado pelo ataque."
  },
  {
    "id": "ataque-provocante",
    "nome": "Ataque Provocante",
    "texto": "Quando você atingir uma criatura com um ataque com arma, você pode gastar um dado de superioridade para tentar incitar a alvo a atacar você. Você adiciona seu dado de superioridade a jogada de dano do ataque e o alvo deve realizar um teste de resistência de Sabedoria. Se falhar, o alvo terá desvantagem em todas as jogadas de ataque contra alvos diferentes de você, até o fim do seu próximo turno."
  },
  {
    "id": "ataque-trespassante",
    "nome": "Ataque Trespassante",
    "texto": "Quando você atingir uma criatura com um ataque corpo-a-corpo com arma, você pode gastar um dado de superioridade para tentar causar dano a outra criatura com o mesmo ataque. Escolha uma criatura a 1,5 metro do alvo original e que esteja no seu alcance. Se a jogada de ataque original atingiria a segunda criatura, ela sofre dano igual ao número rolado no dado de superioridade. O dano é do mesmo tipo que o causado pelo ataque original."
  },
  {
    "id": "contra-atacar",
    "nome": "Contra-Atacar",
    "texto": "Quando uma criatura atacar você com um ataque corpo-a-corpo e errar, você pode usar sua reação e gastar um dado de superioridade para realizar um ataque corpo-a-corpo com arma contra essa criatura. Se você atingir, você adiciona seu dado de superioridade a jogada de dano do ataque."
  },
  {
    "id": "derrubar",
    "nome": "Derrubar",
    "texto": "Quando você atingir uma criatura com um ataque com arma, você pode gastar um dado de superioridade para tentar derrubar o alvo no chão. Você adiciona seu dado de superioridade a jogada de dano do ataque e, se o alvo for Grande ou menor, ele deve realizar um teste de resistência de Força. Se falhar, o alvo ficará caído no chão."
  },
  {
    "id": "golpe-distrativo",
    "nome": "Golpe Distrativo",
    "texto": "Quando você atingir uma criatura com um ataque com arma, você pode gastar um dado de superioridade para tentar distrair a criatura, abrindo uma brecha para um de seus aliados. Você adiciona seu dado de superioridade a jogada de dano do ataque. A próxima jogada de ataque realizada contra o alvo por uma criatura diferente de você, tem vantagem, se o ataque for realizado antes do começo do seu próximo turno."
  },
  {
    "id": "golpe-do-comandante",
    "nome": "Golpe do Comandante",
    "texto": "Quando você realiza a ação de Ataque, no seu turno, você pode desistir de um dos seus ataques e usar uma ação bônus para direcionar o ataque de um dos seus companheiros. Quando você faz isso, escolha uma criatura amigável que possa ver ou ouvir você e gaste um dado de superioridade. Essa criatura pode, imediatamente, usar sua reação para realizar um ataque com arma, adicionando seu dado de superioridade a jogada de dano do ataque."
  },
  {
    "id": "inspirar",
    "nome": "Inspirar",
    "texto": "No seu turno, você pode usar uma ação bônus e gastar um dado de superioridade para reforçar a determinação dos seus companheiros. Quando o fizer, escolha uma criatura amigável que possa ver ou ouvir você. Essa criatura ganha uma quantidade de pontos de vida temporários igual a sua rolagem de dado de superioridade + seu modificador de Carisma."
  },
  {
    "id": "passo-evasivo",
    "nome": "Passo Evasivo",
    "texto": "Quando você se mover, você pode gastar um dado de superioridade, role o dado e adicione o número rolado a sua CA até você terminar seu deslocamento."
  }
];
export const DISCIPLINAS_ELEMENTAIS: OpcaoTexto[] = [
  {
    "id": "cavalgar-o-vento",
    "nome": "Cavalgar o Vento",
    "nivel": 11,
    "texto": "Você pode gastar 4 pontos de chi para conjurar _voo_ em si mesmo_._"
  },
  {
    "id": "chamas-da-fenix",
    "nome": "Chamas da Fénix",
    "nivel": 11,
    "texto": "Você pode gastar 4 pontos de chi para conjurar _bola de fogo._"
  },
  {
    "id": "chicote-de-agua",
    "nome": "Chicote de Água",
    "nivel": 1,
    "texto": "Você pode gastar 2 pontos de chi, com uma ação, para criar um chicote de água que empurra e puxa uma criatura para desequilibrá-la. Uma criatura que você possa ver a até 9 metros deve realizar um teste de resistência de Destreza. Se falhar, a criatura sofre 3d10 de dano de concussão, mais 1d10 de dano de concussão extra para cada ponto de chi adicional que você gastar e você pode tanto derrubar a criatura no chão, quanto puxá-la 7,5 metros para perto de você. Em um sucesso, a criatura sofre metade do dano e você não a puxa ou derruba."
  },
  {
    "id": "defesa-eterna-da-montanha",
    "nome": "Defesa Eterna da Montanha",
    "nivel": 17,
    "texto": "Você pode gastar 5 pontos de chi para conjurar _pele de pedra_ em si mesmo_._"
  },
  {
    "id": "golpe-de-varredura-cauterizante",
    "nome": "Golpe de Varredura Cauterizante",
    "nivel": 1,
    "texto": "Você pode gastar 2 pontos de chi para conjurar _mãos flamejantes._"
  },
  {
    "id": "gongo-do-pico",
    "nome": "Gongo do Pico",
    "nivel": 6,
    "texto": "Você pode gastar 3 pontos de chi para conjurar _despedaçar._"
  },
  {
    "id": "investida-dos-espiritos-da-ventania",
    "nome": "Investida dos Espíritos da Ventania",
    "nivel": 1,
    "texto": "Você pode gastar 2 pontos de chi para conjurar _lufada de vento._"
  },
  {
    "id": "moldar-o-rio-corrente",
    "nome": "Moldar o Rio Corrente",
    "nivel": 1,
    "texto": "Com uma ação, você pode gastar 1 ponto de chi para escolher uma área de gelo ou água, não maior que 9 metros quadrados a até 36 metros de você. Você pode transformar água em gelo dentro da área, e vice-versa e pode remodelar o gelo na área da maneira que desejar. Você pode levantar ou baixar a elevação do gelo, criar encher uma vala, erguer ou achatar uma parede ou formar um pilar. A extensão dessas mudanças não podem exceder metade da maior dimensão da área. Por exemplo, se você afetou 9 metros quadrados, você pode criar um pilar de até 4,5 metros de altura, erguer ou rebaixar a elevação do quadrado em 4,5 metros, escavar uma vala de 4,5 metros de profundidade e assim por diante. Você não pode moldar o gelo para aprisionar ou ferir uma criatura na área."
  },
  {
    "id": "onda-de-pedras-rolantes",
    "nome": "Onda de Pedras Rolantes",
    "nivel": 17,
    "texto": "Você pode gastar 6 pontos de chi para conjurar _muralha de pedra._"
  },
  {
    "id": "postura-da-neblina",
    "nome": "Postura da Neblina",
    "nivel": 11,
    "texto": "Você pode gastar 4 pontos de chi para conjurar _forma gasosa._"
  },
  {
    "id": "presas-da-serpente-de-fogo",
    "nome": "Presas da Serpente de Fogo",
    "nivel": 1,
    "texto": "Quando você usa a ação de Ataque no seu turno, você pode gastar 1 ponto de chi para fazer com que gavinhas de chamas estiquem-se dos seus punho e pés. Seu alcance com seus ataques desarmados aumenta em 3 metros durante essa ação e também pelo resto do seu turno. Um acerto com tal ataque causa dano de fogo, ao invés de dano de concussão e, se você gastar 1 ponto de chi quando atingir o ataque, ele também causará 1d10 de fogo adicional."
  },
  {
    "id": "punho-do-ar-continuo",
    "nome": "Punho do Ar Continuo",
    "nivel": 1,
    "texto": "Você pode criar uma explosão de ar comprimido que atinge como um poderoso soco. Com uma ação, você pode gastar 2 pontos de chi e escolher uma criatura a até 9 metros. A criatura deve realizar um teste de resistência de Força. Se falhar, a criatura sofrerá 3d10 de dano de concussão, mais 1d10 de dano de concussão extra para cada ponto de chi adicional que você gastar e você pode empurrar a criatura para até 6 metros longe de você e derrubá-la no chão. Em um sucesso, a criatura sofre metade do dano e você não a empurra ou derruba."
  },
  {
    "id": "punho-dos-quatro-trovoes",
    "nome": "Punho dos Quatro Trovões",
    "nivel": 1,
    "texto": "Você pode gastar 2 pontos de chi para conjurar _onda trovejante._"
  },
  {
    "id": "rio-de-chamas-famintas",
    "nome": "Rio de Chamas Famintas",
    "nivel": 17,
    "texto": "Você pode gastar 5 pontos de chi para conjurar _muralha de fogo._"
  },
  {
    "id": "serragem-do-vento-do-norte",
    "nome": "Serragem do Vento do Norte",
    "nivel": 6,
    "texto": "Você pode gastar 3 pontos de chi para conjurar _imobilizar pessoa._"
  },
  {
    "id": "sintonia-elemental",
    "nome": "Sintonia Elemental",
    "nivel": 1,
    "texto": "Você pode usar sua ação para, momentaneamente, controlar as forças elementais próximas, causando um dos seguintes efeitos, à sua escolha:\n\n- Criar, instantaneamente, um efeito sensorial inofensivo relacionado à água, ar, fogo ou terra, como uma chuva de faíscas, um sopro de vento, uma leve rajada de névoa ou um suave estrondo de pedra.\n\n- Acender ou apagar, instantaneamente, uma vela, tocha ou pequena fogueira.\n\n- Esfriar ou esquentar 0,5 quilo de material inorgânico por até 1 hora.\n\n- Fazer com que terra, fogo, ar ou névoa que possa caber dentro de 30 centímetros cúbicos se molde em uma forma bruta que você esculpiu por 1 minuto."
  },
  {
    "id": "sopro-do-inverno",
    "nome": "Sopro do Inverno",
    "nivel": 17,
    "texto": "Você pode gastar 6 pontos de chi para conjurar _cone de frio._"
  }
];
