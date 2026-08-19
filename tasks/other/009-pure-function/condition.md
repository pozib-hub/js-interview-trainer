# дана функция, нужно сделать ее чистой

дана функция, нужно сделать ее чистой

  let x = 2;

  const add = async (params, y) => {
    params.value = y;
    y += y + Math.random(params.value);
    x += y;

    console.log('doubling', x);

    const { data } = await axios({ method: 'get', url: '/' });

    const elem = document.getElementById('elem');
    const width = elem.getBoundingClientRect().width;

    return x + data + width;
  };

  add({ value: 4 }, 1);
