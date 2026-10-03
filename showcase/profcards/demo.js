(function(){
  var ENTRY = {
    queueId: 1,
    deckPath: 'Decks/Souls/Bloodborne',
    headerFont: 'HeaderFont.otf',
    descFont: 'DescriptionFont.ttf',
    cardBackFront: '000B.png',
    cardBackBack: '000A.png',
    edition: '1',
    renderMode: 'standard',
    cardId: 15,
    displayName: 'Lady Maria of the Astral Clocktower',
    category: 'Boss',
    region: 'Astral Clocktower',
    description: "Gehrman's finest pupil, keeping the clocktower above the Research Hall. Her Rakuyo demands its wielder's own blood — yet she gave a patient the balcony key, hoping the breeze would comfort her.",
    rarity: 'Unique',
    userDisplay: 'Prof',
    userCardCount: 1,
    deckTotal: 445,
    isNew: true,
    isHolo: false,
    isShiny: false
  };
  var realFetch = window.fetch;
  var served = false;
  window.fetch = function(url){
    var u = String(url);
    if (u.indexOf('/games/profcards') === 0) {
      var body = served ? {active:false} : {active:true, current:ENTRY};
      served = true;
      return Promise.resolve(new Response(JSON.stringify(body), {headers:{'Content-Type':'application/json'}}));
    }
    if (u.indexOf('/health') === 0) return Promise.resolve(new Response('ok'));
    return realFetch.apply(window, arguments);
  };

  function $(id){ return document.getElementById(id); }
  var faceUp = false;

  function settle(){
    if (typeof clearTimers !== 'function' || !$('cardFrame') || !$('cardFrame').src) { setTimeout(settle, 150); return; }
    setTimeout(function(){
      clearTimers();
      ['cardWrap','cardUsername'].forEach(function(id){ $(id).style.transition='opacity .6s ease'; $(id).style.opacity='1'; });
      document.getElementById('demoControls').hidden = false;
    }, 400);
  }

  function flipOver(){
    if (faceUp) return; faceUp = true;
    var flip=$('cardFlip'), glow=$('cardGlow'), label=$('cardLabel'), badge=$('pullBadge'), bind=$('cardBinderText');
    flip.style.transition='transform 1s ease-in-out'; flip.classList.remove('flipped');
    glow.className='card-glow glow-unique';
    label.style.transition='opacity 1s ease'; label.style.opacity='1';
    setTimeout(function(){
      if (!faceUp) return;
      badge.textContent='New!'; badge.classList.add('blinking');
      bind.style.transition='opacity .6s ease'; bind.style.opacity='1';
      bind.classList.remove('count-pop'); void bind.offsetWidth; bind.classList.add('count-pop');
    }, 1100);
  }

  function flipBack(){
    if (!faceUp) return; faceUp = false;
    var flip=$('cardFlip'), glow=$('cardGlow'), label=$('cardLabel'), badge=$('pullBadge'), bind=$('cardBinderText');
    badge.textContent=''; badge.classList.remove('blinking');
    bind.style.opacity='0'; label.style.opacity='0';
    glow.className='card-glow';
    flip.style.transition='transform 1s ease-in-out'; flip.classList.add('flipped');
  }

  document.addEventListener('DOMContentLoaded', function(){
    var bar = document.createElement('div');
    bar.id = 'demoControls'; bar.hidden = true;
    bar.innerHTML = '<button type="button" id="flipOver">Flip over</button><button type="button" id="flipBack">Flip back</button>';
    document.body.appendChild(bar);
    $('flipOver').addEventListener('click', flipOver);
    $('flipBack').addEventListener('click', flipBack);
    settle();
  });
})();
