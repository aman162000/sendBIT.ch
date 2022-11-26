// to open files
const importData = () => {
  let input = document.createElement("input");
  input.type = "file";
  input.onchange = (_) => {
    let files = Array.from(input.files);
    console.log(files);
  };
  input.click();
};

let flag = 0;
const leftSpace = document.getElementById("left-space");
const rightSpace = document.getElementById("right-space");

const createDivElement = (name, device, imgUrl) => {
  let divElement = document.createElement("div");
  divElement.classList.add("element");
  let btn = document.createElement("button");
  btn.className = "btn btn-other-devices";
  btn.addEventListener("click", importData);
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

let imgUrl =
  "https://res.cloudinary.com/duoe2yt88/image/upload/v1668437443/Images/laptop_yjom1q.svg";
let Name = "Polly";
let device = "Windows Chrome";
// otherDeviceLoad(Name, device, imgUrl);

// modals
const openModal = (filename, size) => {
  document.getElementById("modalClick").click();
  setModalvalues(filename, size);
};

const setModalvalues = (filename, size) => {
  document.getElementById("modalFileName").innerText = filename;
  document.getElementById("modalFileSize").innerText = size;
};

// Method to open modal with the params filename and size
// openModal('Picture.png','3 Kb')
