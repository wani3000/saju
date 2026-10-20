/** Independent symbolic prose. These are editorial associations, not validated traits. */
export type RoleFamily="peer"|"output"|"practical"|"structure"|"resource";
export const familyNames:Record<RoleFamily,string>={peer:"자기 기준과 동료 의식",output:"표현과 창작",practical:"실행과 생활 감각",structure:"책임과 기준",resource:"이해와 배움"};
export const roleCopy:Record<string,{family:RoleFamily;title:string;habit:string;strength:string;watch:string;request:string}>={
  비견:{family:"peer",title:"자기 기준을 지키는 결",habit:"내가 납득한 방식으로 선택하고, 동등한 자리에서 의견을 나누는 모습",strength:"남의 반응만 기다리기보다 내 몫을 정하고 꾸준히 해내는 힘",watch:"내 방식이 익숙할수록 조언을 간섭으로 듣거나 도움을 청하는 시점을 놓칠 수 있네",request:"내가 스스로 해 볼 부분을 남겨 줬으면 해"},
  겁재:{family:"peer",title:"함께 움직이는 결",habit:"사람과 힘을 모아 도전하고, 자극을 주고받으며 활기를 얻는 모습",strength:"혼자 망설이는 일을 함께 시작하고 사람을 모으는 힘",watch:"친밀감만 믿고 역할이나 시간 약속을 흐리게 두면 나중에 서운할 수 있네",request:"함께할 일과 각자의 몫을 분명히 정했으면 해"},
  식신:{family:"output",title:"차근차근 만들어 내는 결",habit:"생각을 손에 잡히는 결과물로 만들고, 편안한 일상 속에서 꾸준히 표현하는 모습",strength:"작은 시도를 반복해 나만의 기술이나 즐거움을 쌓는 힘",watch:"편안한 리듬이 소중할수록 갑작스러운 재촉에 마음이 닫힐 수 있네",request:"내 속도로 완성할 시간을 줬으면 해"},
  상관:{family:"output",title:"다른 답을 꺼내는 결",habit:"정해진 말에 머물지 않고 내 생각과 더 나은 방법을 솔직히 꺼내는 모습",strength:"막힌 문제에 새로운 표현과 다른 시각을 보태는 힘",watch:"문제를 바꾸려는 말이 상대에게는 사람을 평가하는 말처럼 들릴 수 있네",request:"다른 의견을 말해도 먼저 들어 줬으면 해"},
  편재:{family:"practical",title:"기회를 행동으로 옮기는 결",habit:"새 기회를 발견하면 사람과 자원을 엮어 먼저 시도해 보는 모습",strength:"생각을 실제 일정과 경험으로 바꾸는 기동력",watch:"하고 싶은 일이 늘면 시간과 약속을 넓게 잡아 마무리가 버거울 수 있네",request:"작게라도 먼저 시험해 볼 기회를 줬으면 해"},
  정재:{family:"practical",title:"일상을 꾸준히 쌓는 결",habit:"필요한 시간과 준비를 따져 계획대로 조금씩 쌓아 가는 모습",strength:"작은 약속을 지키고 생활의 빈틈을 꾸준히 챙기는 힘",watch:"준비한 순서가 바뀔 때 상대의 즉흥성을 무책임함으로 읽지 않도록 살펴보게",request:"일정이 달라지면 미리 알려 줬으면 해"},
  편관:{family:"structure",title:"긴장 속에서도 나서는 결",habit:"어려운 과제와 급한 순간에 기준을 세우고 먼저 대응하는 모습",strength:"피하고 싶은 문제 앞에서도 필요한 행동을 정하는 힘",watch:"스스로 버티는 일이 익숙해지면 내 긴장을 상대에게도 재촉으로 전할 수 있네",request:"급한 때에도 무엇이 우선인지 함께 정했으면 해"},
  정관:{family:"structure",title:"믿을 기준을 세우는 결",habit:"약속과 절차를 중요하게 여기고 서로 납득할 기준을 찾는 모습",strength:"행동을 일관되게 맞추고 상대가 믿을 수 있는 약속을 만드는 힘",watch:"좋은 기준이라도 상대의 사정을 듣기 전에 들이대면 평가받는 느낌을 줄 수 있네",request:"약속의 기준과 예외를 미리 이야기했으면 해"},
  편인:{family:"resource",title:"혼자 깊이 연결하는 결",habit:"남들이 지나친 단서를 살피고 혼자 생각하며 새로운 연결을 찾는 모습",strength:"당연한 설명을 다시 묻고 독특한 해법을 찾는 힘",watch:"혼자 생각하는 시간이 길면 상대는 내가 멀어졌다고 짐작할 수 있네",request:"생각할 시간이 필요해도 마음이 식은 것으로 보지 않았으면 해"},
  정인:{family:"resource",title:"이해하고 받아들이는 결",habit:"먼저 맥락을 이해하고 배우며, 안전한 바탕 위에서 움직이는 모습",strength:"상대의 이야기를 듣고 차근차근 이해를 넓히는 힘",watch:"충분히 이해한 뒤 움직이려다 결정이 늦어지거나 확인을 오래 구할 수 있네",request:"결정하기 전에 이유와 배경을 설명해 줬으면 해"},
};
export const seasons:Record<string,{group:string;label:string;text:string;practice:string}>={
  인:{group:"spring",label:"초봄의 시작",text:"새 방향을 세우고 낯선 일을 시작하는 장면",practice:"시작하고 싶은 일과 아직 준비가 필요한 일을 나누어 보게"},
  묘:{group:"spring",label:"봄의 성장",text:"사람과 아이디어를 넓히며 자기 방식을 키우는 장면",practice:"여러 관심 가운데 이번에 끝낼 것 한 가지를 골라 보게"},
  진:{group:"spring-end",label:"봄에서 여름으로",text:"넓힌 일을 현실의 계획과 다음 단계로 정리하는 장면",practice:"계속할 것과 정리할 것을 함께 적어 보게"},
  사:{group:"summer",label:"초여름의 전개",text:"안에 둔 생각을 밖으로 꺼내고 활동 범위를 넓히는 장면",practice:"새 시도와 쉬는 시간을 일정에 함께 넣어 보게"},
  오:{group:"summer",label:"여름의 활기",text:"표현과 움직임이 밖으로 드러나는 장면",practice:"마음이 뜨거운 순간의 약속은 한 번 더 확인해 보게"},
  미:{group:"summer-end",label:"여름에서 가을로",text:"벌여 놓은 일을 돌보고 생활 속 결과로 남기는 장면",practice:"누가 무엇을 마무리할지 작은 몫을 나누어 보게"},
  신:{group:"autumn",label:"초가을의 정비",text:"흩어진 선택을 점검하고 쓸모 있는 방법을 고르는 장면",practice:"바꾸고 싶은 점과 그대로 두고 싶은 점을 나누어 보게"},
  유:{group:"autumn",label:"가을의 가다듬음",text:"작은 차이를 살피고 필요한 기준을 세우는 장면",practice:"꼭 필요한 기준과 취향의 차이를 구분해 보게"},
  술:{group:"autumn-end",label:"가을에서 겨울로",text:"경험을 정리하고 지킬 약속을 남기는 장면",practice:"이미 끝난 일과 아직 마음에 남은 일을 따로 말해 보게"},
  해:{group:"winter",label:"초겨울의 사색",text:"경험을 안으로 받아들이며 다음 가능성을 궁리하는 장면",practice:"혼자 생각할 시간과 함께 나눌 시간을 정해 보게"},
  자:{group:"winter",label:"겨울의 축적",text:"겉으로 서두르기보다 생각과 준비를 모으는 장면",practice:"답을 정리할 시간이 필요하다면 언제 다시 이야기할지 알려 주게"},
  축:{group:"winter-end",label:"겨울에서 봄으로",text:"모아 둔 생각을 현실적인 준비로 옮기는 장면",practice:"완벽한 준비를 기다리기보다 작은 첫 행동을 정해 보게"},
};
export const familyPractice:Record<RoleFamily,{strength:string;watch:string;practice:string}>={
  peer:{strength:"동등하게 의견을 내고 자기 몫을 맡기",watch:"내 방식과 상대 방식 중 하나만 정답으로 두기",practice:"번갈아 결정할 일과 함께 결정할 일을 나누어 보게"},
  output:{strength:"생각을 말과 작은 결과물로 나누기",watch:"말할 의욕이 커져 서로의 말을 끝까지 듣지 못하기",practice:"한 사람은 설명하고 다른 사람은 들은 뜻을 한 문장으로 되돌려 보게"},
  practical:{strength:"약속을 실제 일정과 행동으로 옮기기",watch:"실행 속도나 준비 방식을 서로의 성의로 판단하기",practice:"담당할 일과 끝낼 시간을 한 가지씩 정해 보게"},
  structure:{strength:"지킬 기준과 약속을 함께 만들기",watch:"좋은 뜻의 기준을 상대에 대한 평가처럼 말하기",practice:"기준에 동의한 이유와 예외가 필요한 상황도 함께 정해 보게"},
  resource:{strength:"말 뒤의 이유를 듣고 이해할 여유 주기",watch:"생각만 오래 나누다 결정할 시점을 놓치기",practice:"생각을 나눌 시간 뒤에 이번에 해 볼 작은 행동도 붙여 보게"},
};
