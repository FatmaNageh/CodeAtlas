const response = await fetch('http://localhost:3000/indexRepo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectPath: 'E:/Graduation Project/CodeAtlas/example_files/project',
    mode: 'full'
  })
});
const data = await response.json();
console.log(JSON.stringify(data, null, 2));
