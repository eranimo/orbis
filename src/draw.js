export function drawDot(ctx, point, color = 'black', size = 1) {
  ctx.beginPath();
  ctx.arc(point.x + 0.5, point.y + 0.5, size, 0, 2 * Math.PI, false);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.closePath();
}

export function drawEdge(ctx, p1, p2, width = 1, style = 'black') {
	ctx.beginPath();
  ctx.moveTo(parseInt(p1.x, 10) + 0.5, parseInt(p1.y, 10) + 0.5);
  ctx.lineTo(parseInt(p2.x, 10) + 0.5, parseInt(p2.y, 10) + 0.5);
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  ctx.stroke();
  ctx.closePath();
}

export function drawArrow(ctx, from, to, r = 10, color = 'black'){
  const {x: fromx, y: fromy} = from;
  const {x: tox, y: toy} = to;

  ctx.fillStyle = color;

	let x_center = tox;
	let y_center = toy;

	let angle;
	let x;
	let y;

	ctx.beginPath();

	angle = Math.atan2(toy - fromy, tox - fromx)
	x = 2 * r * Math.cos(angle) + x_center;
	y = 2 * r * Math.sin(angle) + y_center;

	ctx.moveTo(x, y);

	angle += (1 / 3) * (2 * Math.PI)
	x = r * Math.cos(angle) + x_center;
	y = r * Math.sin(angle) + y_center;

	ctx.lineTo(x, y);

	angle += (1 / 3) * (2 * Math.PI)
	x = r * Math.cos(angle) + x_center;
	y = r * Math.sin(angle) + y_center;

	ctx.lineTo(x, y);
	ctx.closePath();
	ctx.fill();
}

export function drawTriangle(ctx, p_from, p_cell, p_to, color) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.moveTo(p_from.x, p_from.y);
  ctx.lineTo(p_cell.x, p_cell.y);
  ctx.lineTo(p_to.x, p_to.y);
  ctx.fill();
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.strokeWidth = 1.5;
  ctx.stroke();
}
