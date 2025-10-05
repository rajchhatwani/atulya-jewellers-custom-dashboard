import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import {
  Page,
  Layout,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../../shopify.server";

const PRODUCTS_PER_PAGE = 10;

export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const collectionId = `gid://shopify/Collection/${params.id}`;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const response = await admin.graphql(
    `#graphql
      query getCollection($id: ID!) {
        collection(id: $id) {
          id
          title
          products(first: 250) {
            edges {
              node {
                id
                title
                featuredImage {
                  url
                  altText
                }
                priceRangeV2 {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                totalInventory
                status
                variants(first: 1) {
                  edges {
                    node {
                      id
                      barcode
                      inventoryItem {
                        measurement {
                          weight {
                            unit
                            value
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
    {
      variables: { id: collectionId },
    }
  );

  const data = await response.json();
  
  if (!data.data.collection) {
    throw new Response("Collection not found", { status: 404 });
  }

  // Filter products with available inventory by default
  const allProducts = data.data.collection.products.edges
    .map(({ node }) => {
      const variant = node.variants.edges[0]?.node;
      const weightData = variant?.inventoryItem?.measurement?.weight;
      
      let weightDisplay = "N/A";
      if (weightData?.value) {
        const unit = weightData.unit?.toLowerCase() || '';
        weightDisplay = `${weightData.value} ${unit}`;
      }

      return {
        id: node.id,
        title: node.title || "N/A",
        weight: weightDisplay,
        price: node.priceRangeV2.minVariantPrice,
        barcode: variant?.barcode || "N/A",
        availableUnits: node.totalInventory || 0,
      };
    })
    .filter(product => product.availableUnits > 0); // Show only available products

  const totalProducts = allProducts.length;
  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);
  const currentPage = Math.min(Math.max(1, page), totalPages || 1);
  
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = startIndex + PRODUCTS_PER_PAGE;
  const paginatedProducts = allProducts.slice(startIndex, endIndex);

  const collection = {
    id: data.data.collection.id,
    title: data.data.collection.title,
    products: paginatedProducts,
    totalProducts,
    currentPage,
    totalPages,
  };

  return { collection };
}

export default function ProductsPage() {
  const { collection } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currencyCode,
    }).format(price.amount);
  };

  const handlePageChange = (newPage) => {
    setSearchParams({ page: newPage.toString() });
  };

  const rows = collection?.products.map((product) => [
    product.title,
    product.weight,
    formatPrice(product.price),
    product.barcode,
    product.availableUnits.toString(),
  ]);

  return (
    <Page
      title={collection?.title || "Products"}
      backAction={{ content: "Collections", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          {collection?.totalProducts === 0 ? (
            <Card>
              <EmptyState
                heading="No products available in this collection"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>There are no products with available inventory in this collection.</p>
              </EmptyState>
            </Card>
          ) : (
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Products ({collection?.totalProducts} available)
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Product Name", "Weight", "Price", "Barcode", "Available Units"]}
                    rows={rows}
                  />
                </BlockStack>
              </Card>
              
              {collection?.totalPages > 1 && (
                <Card>
                  <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                    <Pagination
                      hasPrevious={collection.currentPage > 1}
                      onPrevious={() => handlePageChange(collection.currentPage - 1)}
                      hasNext={collection.currentPage < collection.totalPages}
                      onNext={() => handlePageChange(collection.currentPage + 1)}
                      label={`Page ${collection.currentPage} of ${collection.totalPages}`}
                    />
                  </div>
                </Card>
              )}
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}