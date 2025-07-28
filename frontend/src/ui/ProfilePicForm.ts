//ProfilePicForm.ts

export function ProfilePicForm(userId: number, profileView: () => void, uploadBase64Image:(userId: number,
    base64Image: string) => Promise<void>, t: (key:string) => string){
    const form = document.getElementById("profilePicForm") as HTMLFormElement | null;
    const input = document.getElementById("profilePicInput") as HTMLInputElement | null;

    if(!form || !input)
        return;

    form.addEventListener("submit", async (e: SubmitEvent) => {
        e.preventDefault();

        const files = input.files;
        if(!files || files.length === 0)
            return;

        const file = files[0];
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if(!allowedTypes.includes(file.type)){
            alert("Format d' image non autorise. Utilise JPEG, PNG ou WebP");
            return;
        }

        const maxSize = 5 * 1024 * 1024;
        if(file.size > maxSize){
            alert("Le fichier est trop volumineux. La taille maximale autorisee est de 5 Mo");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Image = reader.result as string;
            try{
                await uploadBase64Image(userId, base64Image);
                profileView();
            } catch(error) {
                //console.error("Erreur lors de l' upload:", error);
                alert(t("uploadFailed"));
            }
        };
        reader.readAsDataURL(file);
    });
}