// Every Camel Studios game the client knows about.
// repo: where its installers are published (GitHub releases). exe: what gets installed.
// local: an installer on this PC, used when a game (or a newer build) isn't published yet.
module.exports = [
  {
    id: 'dontwakegrandpa', name: "Don't Wake Grandpa", accent: '#b79bff', genre: 'Co-op heist',
    tagline: 'Rob a sleeping giant. Whatever you do, keep it down.',
    about: "Two to four tiny beans sneak out of the mouse hole to pinch a sleeping giant's stuff. He can hear your footsteps, the things you drop and your real microphone. Wake him and he comes after you with a bunny slipper. Dress your whole bean, carry loot over your head, and troll your friends with shrink rays, glue and cream pies.",
    repo: 'Camells1/DontWakeGrandpa', asset: 'DontWakeGrandpa-Setup.exe', exe: 'Dont Wake Grandpa.exe', dir: 'DontWakeGrandpa',
    local: 'D:/Projects/DontWakeGrandpa/dist/DontWakeGrandpa-Setup.exe'
  },
  {
    id: 'nightshiftzoo', name: 'Night Shift Zoo', accent: '#ffc93c', genre: 'Co-op survival',
    tagline: '5 days. 5 nights. Don\'t get eaten.',
    about: 'Two to four keepers walk into the zoo, the gates slam shut, and they stay shut for five days and five nights. Feed the animals, fix the fences, bring your friends back when they get eaten. Everyone is a bean, and there is proximity voice chat.',
    repo: 'Camells1/NightShiftZoo', asset: 'NightShiftZoo-Setup.exe', exe: 'Night Shift Zoo.exe', dir: 'NightShiftZoo',
    local: 'D:/Projects/NightShiftZoo/dist/NightShiftZoo-Setup.exe'
  },
  {
    id: 'riftline', name: 'Riftline', accent: '#ff4655', genre: 'Tactical shooter',
    tagline: 'A tactical 3D 1v1 / 2v2 shooter with agents and abilities.',
    about: 'Pick an agent, buy your loadout and plant or defuse across six maps. Play a friend with a room code, or practise against bots.',
    repo: 'Camells1/riftline', asset: 'Riftline-Setup.exe', exe: 'Riftline.exe', dir: 'Riftline',
    local: 'D:/Floor 2/pvp-shooter/dist/Riftline-Setup.exe'
  },
  {
    id: 'shattercrown', name: 'Shattercrown', accent: '#b98cff', genre: 'Action RPG',
    tagline: 'A pixel-art action RPG with online co-op.',
    about: 'Build a hero, clear the cliffs and the keep, and bring down the bosses alone or with friends.',
    repo: 'Camells1/Emberfall', asset: 'Shattercrown-Setup.exe', exe: 'Shattercrown.exe', dir: 'Shattercrown',
    local: 'D:/Projects/Emberfall/dist/Shattercrown-Setup.exe'
  },
  {
    id: 'hollowtide', name: 'Hollowtide', accent: '#6fe0d0', genre: 'Co-op adventure',
    tagline: 'When the tide drains, the ruins are yours.',
    about: 'A first-person scramble across a drained lagoon: loot sunken cities, fight hollow crabs and get back to an island before the sea returns. Solo or co-op with proximity voice.',
    repo: 'Camells1/Hollowtide', asset: 'Hollowtide-Setup.exe', exe: 'Hollowtide.exe', dir: 'Hollowtide',
    local: 'D:/Projects/Hollowtide/dist/Hollowtide-Setup.exe'
  }
];
