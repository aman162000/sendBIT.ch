let flag = 0;
const leftSpace = document.getElementById("left-space");
const rightSpace = document.getElementById("right-space");

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