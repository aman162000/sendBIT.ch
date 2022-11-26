

let flag = 0;
const leftSpace = document.getElementById("left-space");
const rightSpace = document.getElementById("right-space");

const createDivElement = (name, device, imgUrl) => {
  let divElement = document.createElement("div");
  divElement.classList.add("element");
  let btn = document.createElement("button");
  btn.className = "btn btn-other-devices";
  let image = document.createElement("img");
  image.setAttribute("src", imgUrl);
  let p = document.createElement("p");
  p.textContent = name;
  let i = document.createElement("i");
  i.textContent = device;
  btn.appendChild(image);
  divElement.appendChild(btn);
  divElement.appendChild(p);
  divElement.appendChild(i);

  return divElement;
};

const otherDeviceLoad = (element) => {
  if (
    !(leftSpace.childNodes.length === 3 && rightSpace.childNodes.length === 3)
  ) {
    if (flag === 0) {
      // laptop image: https://res.cloudinary.com/duoe2yt88/image/upload/v1668437443/Images/laptop_yjom1q.svg
      leftSpace.append(element);
      flag = 1;
    } else {
      // mobile image: https://res.cloudinary.com/duoe2yt88/image/upload/v1668437443/Images/mobile_qeibtw.svg
      rightSpace.append(element);
      flag = 0;
    }
  }
};